import type { Step, StepStatus, TriggerDetail, WorkflowDetail, WorkflowStatus } from "../types";
import { isNoisyAutomaticJournalText } from "../utils";

const STOPWORDS = new Set(["de", "el", "la", "los", "las", "por", "para", "con", "en", "un", "una"]);

const OPERATIONAL_WORKFLOW_STATUSES: WorkflowStatus[] = [
  "pendiente",
  "en_proceso",
  "esperando_respuesta",
  "en_espera",
  "con_problema",
];

const OPERATIONAL_STEP_STATUSES: StepStatus[] = ["activo", "espera", "problema", "esperando_respuesta"];

export type DuplicateDetectionInput = {
  taskName: string;
  taskDescription?: string | null;
  workflowObjective?: string | null;
  requirementId?: string | null;
  requirementLabel?: string | null;
  reminderAt?: string | null;
};

export type DuplicateCandidate = {
  workflowId: string;
  score: number;
  taskName: string;
  taskDescription: string | null;
  displayStatus: string;
  workflowStatus: WorkflowStatus;
  stepStatus: StepStatus | null;
  requirementLabels: string[];
  reminderAt: string | null;
  latestComment: string | null;
  latestMovementAt: string | null;
  workflowObjective: string | null;
};

export type RequirementByWorkflowId = Record<string, TriggerDetail[]>;

export function isOperationalWorkflowStatus(status: WorkflowStatus): boolean {
  return OPERATIONAL_WORKFLOW_STATUSES.includes(status);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => token.length > 2 || /\d/.test(token));
}

export function calculateTextSimilarity(a: string, b: string): number {
  const leftTokens = tokenizeText(a);
  const rightTokens = tokenizeText(b);

  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersectionSize = [...leftSet].filter((token) => rightSet.has(token)).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  const shorterSize = Math.min(leftSet.size, rightSet.size);

  if (unionSize === 0 || shorterSize === 0) return 0;

  const jaccard = intersectionSize / unionSize;
  const containment = intersectionSize / shorterSize;
  return Math.max(0, Math.min(1, jaccard * 0.55 + containment * 0.45));
}

export function pickRelevantStep(workflow: WorkflowDetail): Step | null {
  const byOrder = [...workflow.steps].sort((a, b) => a.orden - b.orden);

  const active = byOrder.find((step) => step.estado === "activo");
  if (active) return active;

  const waitingExternal = byOrder.find((step) => step.estado === "esperando_respuesta");
  if (waitingExternal) return waitingExternal;

  const blocked = byOrder.find((step) => step.estado === "problema" || step.estado === "espera");
  if (blocked) return blocked;

  const openByRecentState = [...workflow.steps]
    .filter((step) => step.estado !== "completado" && step.estado !== "cancelada")
    .sort((a, b) => new Date(b.fecha_estado_actual).getTime() - new Date(a.fecha_estado_actual).getTime());
  if (openByRecentState.length > 0) {
    return openByRecentState[0] ?? null;
  }

  return byOrder[0] ?? null;
}

export function buildRequirementByWorkflowId(triggers: TriggerDetail[]): RequirementByWorkflowId {
  const index: RequirementByWorkflowId = {};

  for (const trigger of triggers) {
    for (const workflowId of trigger.workflow_ids) {
      if (!index[workflowId]) {
        index[workflowId] = [];
      }
      index[workflowId].push(trigger);
    }
  }

  return index;
}

function getDisplayStatus(workflow: WorkflowDetail, step: Step | null): string {
  if (workflow.estado === "esperando_respuesta") return "esperando_respuesta";
  if (workflow.estado === "en_espera") return "en_espera";
  if (workflow.estado === "con_problema") return "con_problema";
  if (workflow.estado === "finalizado" || workflow.estado === "cancelado") return workflow.estado;

  if (!step) return workflow.estado;
  if (step.estado === "esperando_respuesta") return "esperando_respuesta";
  if (step.estado === "problema") return "con_problema";
  if (step.estado === "espera") return "en_espera";
  if (step.estado === "activo") return "en_proceso";

  return workflow.estado;
}

function getLatestMovementAt(workflow: WorkflowDetail): string | null {
  return workflow.steps.reduce<string | null>((latest, step) => {
    const candidate =
      step.ultimo_comentario_fecha && step.fecha_estado_actual
        ? new Date(step.ultimo_comentario_fecha).getTime() > new Date(step.fecha_estado_actual).getTime()
          ? step.ultimo_comentario_fecha
          : step.fecha_estado_actual
        : (step.ultimo_comentario_fecha ?? step.fecha_estado_actual);

    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, null);
}

function getRequirementLabels(triggers: TriggerDetail[]): string[] {
  return [...new Set(triggers.map((trigger) => trigger.descripcion?.trim() || `Proyecto ${trigger.id.slice(0, 8)}`))];
}

function getDateBonus(inputDate: string | null | undefined, candidateDate: string | null | undefined): number {
  if (!candidateDate) return 0;

  const candidateTime = new Date(candidateDate).getTime();
  if (!Number.isFinite(candidateTime)) return 0;

  if (inputDate) {
    const inputTime = new Date(inputDate).getTime();
    if (!Number.isFinite(inputTime)) return 0;
    const diffDays = Math.abs(inputTime - candidateTime) / 86400000;
    if (diffDays <= 3) return 0.08;
    if (diffDays <= 7) return 0.05;
    if (diffDays <= 14) return 0.03;
    return 0;
  }

  return candidateTime >= Date.now() ? 0.02 : 0;
}

function hasContainmentMatch(a: string, b: string): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (!normalizedA || !normalizedB) return false;
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

export function findSimilarFlows(
  input: DuplicateDetectionInput,
  workflowsById: Record<string, WorkflowDetail>,
  requirementByWorkflowId: RequirementByWorkflowId
): DuplicateCandidate[] {
  const inputName = input.taskName.trim();
  const inputDescription = input.taskDescription?.trim() ?? "";
  const inputObjective = input.workflowObjective?.trim() ?? "";
  const inputSecondary = [inputDescription, inputObjective, input.requirementLabel?.trim() ?? ""].filter(Boolean).join(" ");

  if (inputName.length < 3 && inputSecondary.length < 3) {
    return [];
  }

  const candidates: DuplicateCandidate[] = [];

  for (const workflow of Object.values(workflowsById)) {
    if (!isOperationalWorkflowStatus(workflow.estado)) {
      continue;
    }

    const relevantStep = pickRelevantStep(workflow);
    if (!relevantStep) {
      continue;
    }

    const requirementLabels = getRequirementLabels(requirementByWorkflowId[workflow.id] ?? []);
    const candidateName = relevantStep.nombre.trim();
    const candidateSecondary = [
      relevantStep.descripcion?.trim() ?? "",
      workflow.objetivo_final?.trim() ?? "",
      relevantStep.ultimo_comentario?.trim() ?? "",
      requirementLabels.join(" "),
    ]
      .filter(Boolean)
      .join(" ");

    const nameSimilarity = Math.max(
      calculateTextSimilarity(inputName, candidateName),
      inputDescription ? calculateTextSimilarity(inputDescription, candidateName) : 0
    );

    if (nameSimilarity < 0.32) {
      continue;
    }

    const secondarySimilarity = inputSecondary ? calculateTextSimilarity(inputSecondary, candidateSecondary) : 0;
    const sameRequirement =
      Boolean(input.requirementId) &&
      (workflow.requirement_ids.includes(input.requirementId!) ||
        (requirementByWorkflowId[workflow.id] ?? []).some((trigger) => trigger.id === input.requirementId));
    const operationalBonus = OPERATIONAL_STEP_STATUSES.includes(relevantStep.estado) ? 0.05 : 0;
    const containmentBonus = hasContainmentMatch(inputName, candidateName) ? 0.08 : 0;
    const dateBonus = getDateBonus(input.reminderAt, relevantStep.fecha_vencimiento ?? relevantStep.fecha_ejecucion_estimada);

    const score = Math.min(
      1,
      nameSimilarity * 0.55 +
        secondarySimilarity * 0.2 +
        (sameRequirement ? 0.12 : 0) +
        operationalBonus +
        containmentBonus +
        dateBonus
    );

    if (score < 0.65) {
      continue;
    }

    const latestComment = relevantStep.ultimo_comentario?.trim();
    candidates.push({
      workflowId: workflow.id,
      score,
      taskName: candidateName,
      taskDescription: relevantStep.descripcion?.trim() || null,
      displayStatus: getDisplayStatus(workflow, relevantStep),
      workflowStatus: workflow.estado,
      stepStatus: relevantStep.estado,
      requirementLabels,
      reminderAt: relevantStep.fecha_vencimiento ?? relevantStep.fecha_ejecucion_estimada,
      latestComment: latestComment && !isNoisyAutomaticJournalText(latestComment) ? latestComment : null,
      latestMovementAt: getLatestMovementAt(workflow),
      workflowObjective: workflow.objetivo_final?.trim() || null,
    });
  }

  return candidates.sort((left, right) => right.score - left.score).slice(0, 3);
}
