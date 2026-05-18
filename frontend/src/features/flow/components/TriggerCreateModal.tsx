import { useRef, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { getWorkflow, listTriggers, listWorkflows, quickCaptureFlow } from "../api";
import { DuplicateFlowWarningDialog } from "./DuplicateFlowWarningDialog";
import type { QuickCaptureInput, TriggerDetail, WorkflowDetail } from "../types";
import { DEFAULT_ACTOR } from "../utils";
import {
  buildRequirementByWorkflowId,
  findSimilarFlows,
  isOperationalWorkflowStatus,
  type DuplicateCandidate,
  type RequirementByWorkflowId,
} from "../utils/duplicateDetection";

type TriggerCreateModalProps = {
  onClose: () => void;
};

type DuplicateCatalog = {
  workflowsById: Record<string, WorkflowDetail>;
  requirementByWorkflowId: RequirementByWorkflowId;
};

export function TriggerCreateModal({ onClose }: TriggerCreateModalProps) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignee, setAssignee] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [pendingPayload, setPendingPayload] = useState<QuickCaptureInput | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const duplicateCatalogRef = useRef<DuplicateCatalog | null>(null);
  const canSubmit = title.trim().length >= 3;

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
      requirementByWorkflowId: buildRequirementByWorkflowId(triggers as TriggerDetail[]),
    } satisfies DuplicateCatalog;

    duplicateCatalogRef.current = catalog;
    return catalog;
  }

  async function performCreate(payload: QuickCaptureInput) {
    try {
      setSubmitting(true);
      setError(null);
      const workflow = await quickCaptureFlow(payload);
      showToast("Tarea capturada.", "success");
      onClose();
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo capturar la tarea");
    } finally {
      setSubmitting(false);
    }
  }

  async function maybeWarnDuplicates(payload: QuickCaptureInput) {
    try {
      setCheckingDuplicates(true);
      const catalog = await loadDuplicateCatalog();
      const candidates = findSimilarFlows(
        {
          taskName: payload.titulo,
          taskDescription: payload.detalle,
          reminderAt: payload.fecha_ejecucion_estimada ?? payload.fecha_vencimiento ?? null,
        },
        catalog.workflowsById,
        catalog.requirementByWorkflowId
      );

      if (candidates.length > 0) {
        setPendingPayload(payload);
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

    const payload = {
      titulo: title.trim(),
      detalle: detail.trim() || null,
      asignado_a: assignee.trim() || DEFAULT_ACTOR,
      fecha_ejecucion_estimada: executionDate ? `${executionDate}T00:00:00Z` : null,
      creado_por: DEFAULT_ACTOR,
    } satisfies QuickCaptureInput;

    const shouldWarn = await maybeWarnDuplicates(payload);
    if (shouldWarn) return;

    await performCreate(payload);
  }

  async function handleCreateAnyway() {
    if (!pendingPayload) return;
    setDuplicateCandidates([]);
    setPendingPayload(null);
    await performCreate(pendingPayload);
  }

  function handleOpenExisting(workflowId: string) {
    setDuplicateCandidates([]);
    setPendingPayload(null);
    navigate(`/workflows/${workflowId}`);
  }

  function handleCancelDuplicateWarning() {
    setDuplicateCandidates([]);
    setPendingPayload(null);
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
            <TextField
              autoFocus
              label="¿Qué tenés que hacer? *"
              multiline
              minRows={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Pedir layout actualizado al proveedor"
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
            Se crea un flow con una tarea activa inicial.
          </Typography>
          <Stack direction="row" spacing={1.25}>
            <Button variant="text" color="inherit" onClick={handleClose} disabled={submitting || checkingDuplicates}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting || checkingDuplicates || !canSubmit}
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
