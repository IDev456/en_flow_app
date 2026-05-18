import type { Step, StepStatus, TriggerDetail, WorkflowDetail, WorkflowStatus } from "../types";
import { getVisibleWorkflowStatus, isNoisyAutomaticJournalText } from "../utils";

const STOPWORDS = new Set([
  "de",
  "el",
  "la",
  "los",
  "las",
  "por",
  "para",
  "con",
  "en",
  "un",
  "una",
  "pedir",
  "consultar",
  "revisar",
  "validar",
  "enviar",
  "hacer",
  "tema",
  "tarea",
  "pendiente",
]);

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

export function stemToken(token: string): string {
  let stemmed = normalizeText(token);
  if (stemmed.length < 3) return stemmed;

  if (stemmed.endsWith("es") && stemmed.length > 4) {
    stemmed = stemmed.slice(0, -2);
  } else if (stemmed.endsWith("s") && stemmed.length > 4) {
    stemmed = stemmed.slice(0, -1);
  }

  const suffixes = [
    "ciones",
    "cion",
    "mientos",
    "miento",
    "adoras",
    "adores",
    "adora",
    "ador",
    "ados",
    "adas",
    "ado",
    "ada",
    "idos",
    "idas",
    "ido",
    "ida",
    "ar",
    "er",
    "ir",
  ];

  for (const suffix of suffixes) {
    if (stemmed.endsWith(suffix) && stemmed.length - suffix.length >= 3) {
      stemmed = stemmed.slice(0, -suffix.length);
      break;
    }
  }

  return stemmed.length >= 3 ? stemmed : normalizeText(token);
}

export function getSignificantTokens(text: string): string[] {
  return [...new Set(tokenizeText(text).map((token) => stemToken(token)).filter((token) => token.length >= 3))];
}

export function calculateTokenOverlapScore(inputTokens: string[], candidateTokens: string[]): number {
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0;

  const inputSet = new Set(inputTokens);
  const candidateSet = new Set(candidateTokens);
  const matches = [...inputSet].filter((token) => candidateSet.has(token)).length;
  return matches / inputSet.size;
}

function tokensPartiallyMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 4 && right.length < 4) return false;
  return left.startsWith(right) || right.startsWith(left);
}

export function calculatePartialTokenScore(inputTokens: string[], candidateTokens: string[]): number {
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0;

  const matchedCount = inputTokens.filter((inputToken) => candidateTokens.some((candidateToken) => tokensPartiallyMatch(inputToken, candidateToken))).length;
  return matchedCount / inputTokens.length;
}

export function calculateTextSimilarity(a: string, b: string): number {
  const leftTokens = getSignificantTokens(a);
  const rightTokens = getSignificantTokens(b);

  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const overlap = calculateTokenOverlapScore(leftTokens, rightTokens);
  const partial = calculatePartialTokenScore(leftTokens, rightTokens);
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  const intersectionSize = [...new Set(leftTokens)].filter((token) => new Set(rightTokens).has(token)).length;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

  return Math.max(0, Math.min(1, overlap * 0.45 + partial * 0.35 + jaccard * 0.2));
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
    if (diffDays <= 7) return 0.06;
    if (diffDays <= 14) return 0.04;
    return 0;
  }

  return candidateTime >= Date.now() ? 0.05 : 0;
}

function hasContainmentMatch(a: string, b: string): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (!normalizedA || !normalizedB) return false;
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

function calculateFieldCoverageScore(inputTokens: string[], candidateTokens: string[]): number {
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0;

  const matches = inputTokens.filter((inputToken) => candidateTokens.some((candidateToken) => tokensPartiallyMatch(inputToken, candidateToken))).length;
  return matches / inputTokens.length;
}

function countMatchedTokens(inputTokens: string[], candidateTokens: string[]): number {
  return inputTokens.filter((inputToken) => candidateTokens.some((candidateToken) => tokensPartiallyMatch(inputToken, candidateToken))).length;
}

export function findSimilarFlows(
  input: DuplicateDetectionInput,
  workflowsById: Record<string, WorkflowDetail>,
  requirementByWorkflowId: RequirementByWorkflowId
): DuplicateCandidate[] {
  const inputName = input.taskName.trim();
  const inputDescription = input.taskDescription?.trim() ?? "";
  const inputObjective = input.workflowObjective?.trim() ?? "";
  const inputPrimary = [inputName, inputDescription].filter(Boolean).join(" ");
  const inputSecondary = [inputDescription, inputObjective, input.requirementLabel?.trim() ?? ""].filter(Boolean).join(" ");
  const inputTokens = getSignificantTokens([inputName, inputDescription, inputObjective].filter(Boolean).join(" "));

  if (inputTokens.length === 0 && normalizeText(`${inputName} ${inputDescription}`).length < 3) {
    return [];
  }

  const minimumScore = inputTokens.length === 1 ? 0.6 : 0.46;
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
    const candidateSecondaryText = [
      relevantStep.descripcion?.trim() ?? "",
      workflow.objetivo_final?.trim() ?? "",
      relevantStep.ultimo_comentario?.trim() ?? "",
      requirementLabels.join(" "),
    ]
      .filter(Boolean)
      .join(" ");
    const candidateNameTokens = getSignificantTokens(candidateName);
    const candidateSecondaryTokens = getSignificantTokens(candidateSecondaryText);
    const candidateAllTokens = getSignificantTokens([candidateName, candidateSecondaryText].filter(Boolean).join(" "));

    const nameSimilarity = Math.max(
      calculateTextSimilarity(inputName, candidateName),
      inputDescription ? calculateTextSimilarity(inputDescription, candidateName) : 0,
      inputObjective ? calculateTextSimilarity(inputObjective, candidateName) : 0
    );
    const nameTokenOverlap = calculateTokenOverlapScore(inputTokens, candidateNameTokens);
    const partialTokenScore = calculatePartialTokenScore(inputTokens, candidateAllTokens);
    const fieldCoverageScore = calculateFieldCoverageScore(inputTokens, candidateAllTokens);
    const secondaryOverlapScore = inputSecondary ? calculateTokenOverlapScore(inputTokens, candidateSecondaryTokens) : 0;
    const sameRequirement =
      Boolean(input.requirementId) &&
      (workflow.requirement_ids.includes(input.requirementId!) ||
        (requirementByWorkflowId[workflow.id] ?? []).some((trigger) => trigger.id === input.requirementId));
    const operationalBonus = OPERATIONAL_STEP_STATUSES.includes(relevantStep.estado) ? 0.04 : 0;
    const containmentBonus = hasContainmentMatch(inputPrimary, candidateName) ? 0.06 : 0;
    const dateBonus = getDateBonus(input.reminderAt, relevantStep.fecha_vencimiento ?? relevantStep.fecha_ejecucion_estimada);
    const matchedTokenBonus = countMatchedTokens(inputTokens, candidateAllTokens) >= 2 ? 0.05 : 0;

    const score = Math.min(
      1,
      nameSimilarity * 0.22 +
        nameTokenOverlap * 0.22 +
        partialTokenScore * 0.18 +
        fieldCoverageScore * 0.18 +
        secondaryOverlapScore * 0.1 +
        containmentBonus +
        (sameRequirement ? 0.12 : 0) +
        operationalBonus +
        dateBonus +
        matchedTokenBonus
    );

    if (score < minimumScore) {
      continue;
    }

    const latestComment = relevantStep.ultimo_comentario?.trim();
    candidates.push({
      workflowId: workflow.id,
      score,
      taskName: candidateName,
      taskDescription: relevantStep.descripcion?.trim() || null,
      displayStatus: getVisibleWorkflowStatus(workflow),
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
