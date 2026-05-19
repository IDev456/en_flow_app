import { useEffect, useRef, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { getWorkflow, listTriggers, listWorkflows, quickCaptureFlow, startWorkflow } from "../api";
import { AmbitoChip } from "./AmbitoChip";
import { DuplicateFlowWarningDialog } from "./DuplicateFlowWarningDialog";
import { LiveDuplicateSuggestions } from "./LiveDuplicateSuggestions";
import type { Ambito, QuickCaptureInput, TriggerDetail, WorkflowDetail, WorkflowStartInput } from "../types";
import { DEFAULT_ACTOR, getAmbitoLabel, getStoredActiveAmbito } from "../utils";
import {
  buildRequirementByWorkflowId,
  findSimilarFlows,
  getSignificantTokens,
  isOperationalWorkflowStatus,
  normalizeText,
  type DuplicateCandidate,
  type RequirementByWorkflowId,
} from "../utils/duplicateDetection";

type TriggerCreateModalProps = {
  onClose: () => void;
  defaultRequirementId?: string;
  defaultRequirementLabel?: string;
  defaultAmbito?: "laboral" | "personal";
};

type DuplicateCatalog = {
  workflowsById: Record<string, WorkflowDetail>;
  requirementByWorkflowId: RequirementByWorkflowId;
  triggersById: Record<string, TriggerDetail>;
};

type PendingCreation =
  | {
      kind: "quick";
      payload: QuickCaptureInput;
    }
  | {
      kind: "linked";
      requirementId: string;
      requirementLabel: string | null;
      payload: WorkflowStartInput;
    };

export function TriggerCreateModal({ onClose, defaultRequirementId, defaultRequirementLabel, defaultAmbito }: TriggerCreateModalProps) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignee, setAssignee] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [checkingLiveDuplicates, setCheckingLiveDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [ambito] = useState<Exclude<Ambito, null>>(() => defaultAmbito ?? getStoredActiveAmbito());
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [liveDuplicateCandidates, setLiveDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [pendingCreation, setPendingCreation] = useState<PendingCreation | null>(null);
  const [linkedRequirementAmbito, setLinkedRequirementAmbito] = useState<Ambito>(null);
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const duplicateCatalogRef = useRef<DuplicateCatalog | null>(null);
  const liveRequestIdRef = useRef(0);
  const titleInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const canSubmit = title.trim().length >= 3;
  const linkedRequirementLabel = defaultRequirementLabel?.trim() || null;
  const isLinkedCapture = Boolean(defaultRequirementId);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 40);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function handleClose() {
    if (title.trim() || detail.trim() || assignee.trim() || executionDate) {
      if (!window.confirm("¿Cerrar sin guardar? Se perderán los datos ingresados.")) {
        return;
      }
    }
    onClose();
  }

  async function loadDuplicateCatalog() {
    if (duplicateCatalogRef.current) {
      return duplicateCatalogRef.current;
    }

    const [workflowSummaries, triggers] = await Promise.all([listWorkflows(), listTriggers()]);
    const operationalIds = workflowSummaries.filter((workflow) => isOperationalWorkflowStatus(workflow.estado)).map((workflow) => workflow.id);
    const workflowDetails = await Promise.all(operationalIds.map((workflowId) => getWorkflow(workflowId)));

    const catalog = {
      workflowsById: Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])),
      requirementByWorkflowId: buildRequirementByWorkflowId(triggers),
      triggersById: Object.fromEntries(triggers.map((trigger) => [trigger.id, trigger])),
    } satisfies DuplicateCatalog;

    duplicateCatalogRef.current = catalog;
    return catalog;
  }

  function buildCreation(): PendingCreation {
    if (defaultRequirementId) {
      return {
        kind: "linked",
        requirementId: defaultRequirementId,
        requirementLabel: linkedRequirementLabel,
        payload: {
          objetivo_final: title.trim(),
          resolucion_esperada: "Flujo completado con validacion final",
          ambito: linkedRequirementAmbito,
          primer_paso: {
            nombre: title.trim(),
            descripcion: detail.trim() || null,
            asignado_a: assignee.trim() || DEFAULT_ACTOR,
            fecha_vencimiento: executionDate ? `${executionDate}T00:00:00Z` : null,
          },
        },
      };
    }

    return {
      kind: "quick",
      payload: {
        titulo: title.trim(),
        detalle: detail.trim() || null,
        asignado_a: assignee.trim() || DEFAULT_ACTOR,
        fecha_ejecucion_estimada: executionDate ? `${executionDate}T00:00:00Z` : null,
        creado_por: DEFAULT_ACTOR,
        ambito,
      },
    };
  }

  function buildDuplicateInput(creation: PendingCreation) {
    if (creation.kind === "linked") {
      return {
        taskName: creation.payload.primer_paso.nombre,
        taskDescription: creation.payload.primer_paso.descripcion,
        workflowObjective: creation.payload.objetivo_final,
        requirementId: creation.requirementId,
        requirementLabel: creation.requirementLabel,
        reminderAt: creation.payload.primer_paso.fecha_vencimiento ?? creation.payload.primer_paso.fecha_ejecucion_estimada ?? null,
        ambito: creation.payload.ambito ?? null,
      };
    }

    return {
      taskName: creation.payload.titulo,
      taskDescription: creation.payload.detalle,
      reminderAt: creation.payload.fecha_ejecucion_estimada ?? creation.payload.fecha_vencimiento ?? null,
      ambito: creation.payload.ambito,
    };
  }

  useEffect(() => {
    if (!defaultRequirementId) {
      setLinkedRequirementAmbito(null);
      return;
    }

    void loadDuplicateCatalog()
      .then((catalog) => {
        setLinkedRequirementAmbito(catalog.triggersById[defaultRequirementId]?.ambito ?? null);
      })
      .catch(() => {
        setLinkedRequirementAmbito(null);
      });
  }, [defaultRequirementId]);

  useEffect(() => {
    const inputText = `${title} ${detail}`.trim();
    const normalizedInput = normalizeText(inputText);
    const significantTokens = getSignificantTokens(inputText);

    if (significantTokens.length === 0 || normalizedInput.length < 3 || (isLinkedCapture && linkedRequirementAmbito === null)) {
      liveRequestIdRef.current += 1;
      setCheckingLiveDuplicates(false);
      setLiveDuplicateCandidates([]);
      return;
    }

    const requestId = liveRequestIdRef.current + 1;
    liveRequestIdRef.current = requestId;

    const timeoutId = window.setTimeout(async () => {
      setCheckingLiveDuplicates(true);

      try {
        const catalog = await loadDuplicateCatalog();
        if (liveRequestIdRef.current !== requestId) return;

        const candidates = findSimilarFlows(
          {
            taskName: title.trim(),
            taskDescription: detail.trim() || null,
            workflowObjective: isLinkedCapture ? title.trim() : null,
            requirementId: defaultRequirementId ?? null,
            requirementLabel: linkedRequirementLabel,
            reminderAt: executionDate ? `${executionDate}T00:00:00Z` : null,
            ambito: isLinkedCapture ? linkedRequirementAmbito : ambito,
          },
          catalog.workflowsById,
          catalog.requirementByWorkflowId
        );

        if (liveRequestIdRef.current !== requestId) return;
        setLiveDuplicateCandidates(candidates);
      } catch (err) {
        if (liveRequestIdRef.current !== requestId) return;
        console.warn("No se pudieron cargar sugerencias de duplicados en vivo.", err);
        setLiveDuplicateCandidates([]);
      } finally {
        if (liveRequestIdRef.current === requestId) {
          setCheckingLiveDuplicates(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [title, detail, executionDate, isLinkedCapture, linkedRequirementAmbito, defaultRequirementId, linkedRequirementLabel]);

  async function performCreate(creation: PendingCreation) {
    try {
      setSubmitting(true);
      setError(null);
      const workflow =
        creation.kind === "linked"
          ? await startWorkflow(creation.requirementId, creation.payload)
          : await quickCaptureFlow(creation.payload);
      if (creation.kind === "linked") {
        showToast("Tarea vinculada al proyecto.", "success");
      } else if (creation.payload.ambito !== getStoredActiveAmbito()) {
        showToast(
          `Tarea capturada como ${getAmbitoLabel(creation.payload.ambito)}. Cambiá a ${getAmbitoLabel(creation.payload.ambito)} para verla en la lista.`,
          "info"
        );
      } else {
        showToast("Tarea capturada.", "success");
      }
      onClose();
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : creation.kind === "linked"
            ? "No se pudo crear la tarea vinculada"
            : "No se pudo capturar la tarea"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function maybeWarnDuplicates(creation: PendingCreation) {
    try {
      setCheckingDuplicates(true);
      const catalog = await loadDuplicateCatalog();
      const candidates = findSimilarFlows(buildDuplicateInput(creation), catalog.workflowsById, catalog.requirementByWorkflowId);

      if (candidates.length > 0) {
        setPendingCreation(creation);
        setDuplicateCandidates(candidates);
        return true;
      }

      return false;
    } catch (err) {
      console.warn("No se pudo revisar duplicados antes de capturar la tarea.", err);
      return false;
    } finally {
      setCheckingDuplicates(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Escribe la tarea principal para capturar el flow.");
      return;
    }
    if (isLinkedCapture && linkedRequirementAmbito === null) {
      setError("Debes definir el ámbito del proyecto antes de crear un flow vinculado.");
      return;
    }

    const creation = buildCreation();
    const shouldWarn = await maybeWarnDuplicates(creation);
    if (shouldWarn) return;

    await performCreate(creation);
  }

  async function handleCreateAnyway() {
    if (!pendingCreation) return;
    setDuplicateCandidates([]);
    setPendingCreation(null);
    await performCreate(pendingCreation);
  }

  function handleOpenExisting(workflowId: string) {
    setDuplicateCandidates([]);
    setPendingCreation(null);
    navigate(`/workflows/${workflowId}`);
  }

  function handleOpenExistingFromSuggestions(workflowId: string) {
    navigate(`/workflows/${workflowId}`);
  }

  function handleCancelDuplicateWarning() {
    setDuplicateCandidates([]);
    setPendingCreation(null);
  }

  return (
    <>
      <Dialog open onClose={submitting || checkingDuplicates ? undefined : () => handleClose()} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Captura rápida
            </Typography>
            <Typography variant="h4">Capturar tarea</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: "outlineVariant" }}>
          <Stack spacing={2.5}>
            {isLinkedCapture && linkedRequirementLabel && (
              <Alert severity={linkedRequirementAmbito ? "info" : "warning"} sx={{ py: 0.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography component="span">Proyecto vinculado: {linkedRequirementLabel}</Typography>
                  <AmbitoChip ambito={linkedRequirementAmbito} />
                </Stack>
              </Alert>
            )}
            {!isLinkedCapture && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography component="span">Se creará como:</Typography>
                  <AmbitoChip ambito={ambito} />
                </Stack>
              </Alert>
            )}
            <TextField
              autoFocus
              inputRef={titleInputRef}
              label="¿Qué tenés que hacer? *"
              multiline
              minRows={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Pedir layout actualizado al proveedor"
              disabled={isLinkedCapture && linkedRequirementAmbito === null}
            />

            <LiveDuplicateSuggestions
              candidates={liveDuplicateCandidates}
              checking={checkingLiveDuplicates}
              onOpenExisting={handleOpenExistingFromSuggestions}
            />

            <Button variant="text" color="inherit" onClick={() => setShowOptional((current) => !current)} sx={{ alignSelf: "flex-start", px: 0.5 }}>
              <TuneRoundedIcon sx={{ fontSize: 16, mr: 0.6 }} />
              {showOptional ? "Ocultar datos opcionales" : "Agregar datos opcionales"}
            </Button>

            <Collapse in={showOptional} timeout={220}>
              <Box
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: "outlineVariant",
                  backgroundColor: (theme) =>
                    alpha(theme.palette.surfaceContainerLow, theme.palette.mode === "dark" ? 0.84 : 0.98),
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Datos opcionales
                  </Typography>
                  <TextField label="Detalle" multiline minRows={2} value={detail} onChange={(event) => setDetail(event.target.value)} />
                  <TextField label="Asignado a" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
                  <TextField
                    label="Fecha"
                    type="date"
                    value={executionDate}
                    onChange={(event) => setExecutionDate(event.target.value)}
                    helperText="Posible fecha de ejecución"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              </Box>
            </Collapse>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary">
            {isLinkedCapture ? "Se creará un flow vinculado a este proyecto." : "Se crea un flow con una tarea activa inicial."}
          </Typography>
          <Stack direction="row" spacing={1.25}>
            <Button variant="text" color="inherit" onClick={handleClose} disabled={submitting || checkingDuplicates}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting || checkingDuplicates || !canSubmit || (isLinkedCapture && linkedRequirementAmbito === null)}
              startIcon={<AddTaskRoundedIcon />}
            >
              {checkingDuplicates ? "Revisando..." : submitting ? "Guardando..." : "Capturar tarea"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <DuplicateFlowWarningDialog
        open={duplicateCandidates.length > 0}
        candidates={duplicateCandidates}
        busy={submitting}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={() => void handleCreateAnyway()}
        onCancel={handleCancelDuplicateWarning}
      />
    </>
  );
}
