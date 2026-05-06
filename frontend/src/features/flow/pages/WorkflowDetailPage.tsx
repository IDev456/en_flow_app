import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";

import {
  addStepComment,
  completeStep,
  getStepComments,
  getWorkflow,
  getStepHistory,
  linkWorkflowRequirement,
  listTriggers,
  registerExternalEvent,
  resolveExternalResponse,
  unlinkWorkflowRequirement,
  updateStepStatus,
} from "../api";
import { StepDetailPanel } from "../components/StepDetailPanel";
import { CompleteStepDialog } from "../components/CompleteStepDialog";
import { WorkflowGraph } from "../components/WorkflowGraph";
import type {
  ExternalEventCreateInput,
  ExternalResponseDecisionInput,
  Step,
  StepComment,
  StepCompleteInput,
  StepHistoryEntry,
  StepJournalEntryInput,
  TriggerDetail,
  WorkflowDetail,
} from "../types";
import { DEFAULT_ACTOR, formatDate, formatElapsedTime } from "../utils";

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const initialToastMessage = (location.state as { toast?: string } | null)?.toast ?? null;
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [requirements, setRequirements] = useState<TriggerDetail[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingCompleteDialogStepId, setPendingCompleteDialogStepId] = useState<string | null>(null);
  const [stepComments, setStepComments] = useState<StepComment[]>([]);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [linkRequirementOpen, setLinkRequirementOpen] = useState(false);
  const [linkRequirementId, setLinkRequirementId] = useState("");
  const [linkRequirementError, setLinkRequirementError] = useState<string | null>(null);
  const [linkingRequirement, setLinkingRequirement] = useState(false);
  const [unlinkingRequirementId, setUnlinkingRequirementId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(Boolean(initialToastMessage));
  const [toastMessage, setToastMessage] = useState<string | null>(initialToastMessage);

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Flow sin requerimiento";
  }

  function pickRelevantStep(workflowData: WorkflowDetail) {
    const byOrder = [...workflowData.steps].sort((a, b) => a.orden - b.orden);
    return (
      byOrder.find((step) => step.estado === "activo") ??
      byOrder.find((step) => step.estado === "esperando_respuesta") ??
      byOrder.find((step) => step.estado === "espera" || step.estado === "problema") ??
      byOrder[0] ??
      null
    );
  }

  useEffect(() => {
    void loadWorkflow();
  }, [workflowId]);

  useEffect(() => {
    if (selectedStepId) {
      void loadStepSideData(selectedStepId);
    } else {
      setStepComments([]);
      setStepHistory([]);
    }
  }, [selectedStepId]);

  async function loadWorkflow(preferredStepId?: string) {
    try {
      setLoading(true);
      setError(null);
      const [workflowData, requirementData] = await Promise.all([getWorkflow(workflowId), listTriggers()]);
      setWorkflow(workflowData);
      setRequirements(requirementData);
      const stepExistsInWorkflow = workflowData.steps.some((step) => step.id === selectedStepId);
      const openStatuses = new Set(["activo", "espera", "problema", "esperando_respuesta"]);
      const nextSelectedStepId =
        preferredStepId ??
        (stepExistsInWorkflow ? selectedStepId : null) ??
        workflowData.steps.find((step) => openStatuses.has(step.estado))?.id ??
        workflowData.steps[0]?.id ??
        null;
      setSelectedStepId(nextSelectedStepId);
      const primaryRequirementId = workflowData.trigger_id ?? workflowData.requirement_ids[0] ?? null;
      setTrigger(primaryRequirementId ? requirementData.find((item) => item.id === primaryRequirementId) ?? null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el flow");
    } finally {
      setLoading(false);
    }
  }

  async function loadStepSideData(stepId: string) {
    try {
      setPanelError(null);
      const [comments, history] = await Promise.all([getStepComments(stepId), getStepHistory(stepId)]);
      setStepComments(comments);
      setStepHistory(history);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "No se pudo cargar los registros de la tarea");
    }
  }

  async function refreshAfterStepChange(preferredStepId?: string) {
    await loadWorkflow(preferredStepId);
    if (preferredStepId) {
      await loadStepSideData(preferredStepId);
    }
  }

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    if (!selectedStepId) return;

    if (!input.estado) {
      await addStepComment(selectedStepId, {
        autor: DEFAULT_ACTOR,
        comentario: input.comentario,
        attachments: input.attachments ?? [],
      });
      await loadStepSideData(selectedStepId);
      return;
    }

    await updateStepStatus(selectedStepId, {
      estado: input.estado,
      usuario: DEFAULT_ACTOR,
      nota: input.comentario,
      attachments: input.attachments ?? [],
    });
    await refreshAfterStepChange(selectedStepId);
  }

  async function handleCompleteTask(stepId: string, input: StepCompleteInput) {
    try {
      const step = workflow?.steps.find(s => s.id === stepId);
      if (!step) return;

      if (step.estado === "esperando_respuesta") {
        // Si ya estaba en espera externa, usamos resolveExternalResponse
        // Mapeamos al payload que espera el backend para esta accion
        await resolveExternalResponse(stepId, {
          usuario: input.usuario,
          resultado_cierre: input.resultado_cierre ?? "Completado tras espera externa",
          comentario: input.comentario ?? input.resultado_cierre ?? "Resuelto",
          transition_type: input.transition_type,
          next_task: input.next_task,
          finish_data: input.finish_data,
          attachments: input.attachments,
        });
      } else {
        // Flujo estandar para tareas activas, en pausa o con problema
        await completeStep(stepId, input);
      }

      const currentWorkflow = await getWorkflow(workflowId);
      const nextActiveStep =
        currentWorkflow.steps.find((workflowStep) => workflowStep.estado === "activo") ??
        currentWorkflow.steps.find((workflowStep) => ["espera", "problema", "esperando_respuesta"].includes(workflowStep.estado));
      
      await refreshAfterStepChange(nextActiveStep?.id ?? stepId);
      showToast("Tarea completada.", "success");
      setPendingCompleteDialogStepId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al completar";
      showToast(msg, "error");
      throw err; // Re-throw para que el dialogo maneje el estado de error
    }
  }

  async function handleRegisterExternalEvent(stepId: string, input: ExternalEventCreateInput) {
    await registerExternalEvent(stepId, input);
    await refreshAfterStepChange(stepId);
  }

  async function handleResolveExternalResponse(stepId: string, input: ExternalResponseDecisionInput) {
    await resolveExternalResponse(stepId, input);
    const refreshedWorkflow = await getWorkflow(workflowId);
    const nextActiveStep =
      refreshedWorkflow.steps.find((workflowStep) => workflowStep.estado === "activo") ??
      refreshedWorkflow.steps.find((workflowStep) => ["espera", "problema", "esperando_respuesta"].includes(workflowStep.estado));
    await refreshAfterStepChange(nextActiveStep?.id ?? stepId);
  }

  function handleSelectStep(stepId: string) {
    setSelectedStepId(stepId);
  }

  function handleOpenStep(stepId: string) {
    setSelectedStepId(stepId);
    setPanelOpen(true);
  }

  function handleOpenCompleteStep(stepId: string) {
    setSelectedStepId(stepId);
    setPendingCompleteDialogStepId(stepId); // Solo activamos el modal, no el panel lateral
  }

  function handleCompleteDialogOpened() {
    setPendingCompleteDialogStepId(null);
  }

  async function handleStepUpdated(step: Step) {
    await refreshAfterStepChange(step.id);
  }

  function handleOpenLinkRequirement() {
    if (!workflow) return;
    const linkedRequirementIds = new Set([
      ...(workflow.requirement_ids ?? []),
      ...(workflow.trigger_id ? [workflow.trigger_id] : []),
    ]);
    const nextRequirementId = requirements.find((item) => !linkedRequirementIds.has(item.id))?.id ?? "";
    setLinkRequirementError(null);
    setLinkRequirementId(nextRequirementId);
    setLinkRequirementOpen(true);
  }

  function handleCloseLinkRequirement() {
    setLinkRequirementOpen(false);
    setLinkRequirementError(null);
    setLinkRequirementId("");
  }

  async function handleLinkRequirement() {
    if (!workflow || !linkRequirementId) {
      setLinkRequirementError("Selecciona un requerimiento para vincular.");
      return;
    }

    try {
      setLinkingRequirement(true);
      setLinkRequirementError(null);
      await linkWorkflowRequirement(workflow.id, { requirement_id: linkRequirementId });
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Requerimiento asociado.");
      setToastOpen(true);
      handleCloseLinkRequirement();
    } catch (err) {
      setLinkRequirementError(err instanceof Error ? err.message : "No se pudo asociar el requerimiento");
    } finally {
      setLinkingRequirement(false);
    }
  }

  async function handleUnlinkRequirement(requirementId: string, requirementLabel: string) {
    if (!workflow) return;

    const confirmed = window.confirm(
      `¿Desvincular este requerimiento del flow?\n\n${requirementLabel}\n\nEl requerimiento y el flow seguirán existiendo. Solo se quitará la asociación.`
    );
    if (!confirmed) return;

    try {
      setUnlinkingRequirementId(requirementId);
      setLinkRequirementError(null);
      await unlinkWorkflowRequirement(workflow.id, requirementId);
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Requerimiento desvinculado.");
      setToastOpen(true);
      handleCloseLinkRequirement();
    } catch (err) {
      setLinkRequirementError(err instanceof Error ? err.message : "No se pudo desvincular el requerimiento");
    } finally {
      setUnlinkingRequirementId(null);
    }
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando flow...</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!workflow) {
    return <Alert severity="info">Flow no encontrado.</Alert>;
  }

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? pickRelevantStep(workflow);
  const linkedRequirementIds = new Set([...(workflow.requirement_ids ?? []), ...(workflow.trigger_id ? [workflow.trigger_id] : [])]);
  const linkedRequirements = requirements.filter(
    (item) => linkedRequirementIds.has(item.id) || item.workflow_ids.includes(workflow.id)
  );
  const availableRequirements = requirements.filter((item) => !linkedRequirements.some((linked) => linked.id === item.id));
  const linkedRequirementLabel =
    linkedRequirements.length === 1 ? "1 requerimiento vinculado" : `${linkedRequirements.length} requerimientos vinculados`;
  const managingRequirementsBusy = linkingRequirement || unlinkingRequirementId !== null;

  return (
    <Stack spacing={3}>
      <Snackbar
        open={toastOpen}
        autoHideDuration={2600}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
      />
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/flows">
          Flows
        </Link>
        {trigger && (
          <Link component={RouterLink} underline="hover" color="inherit" to={`/requirements/${trigger.id}`}>
            {getPrimaryRequirementLabel()}
          </Link>
        )}
        <Typography color="text.primary">Flow</Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          alignItems: "start",
          gridTemplateColumns: panelOpen && selectedStep ? { xs: "1fr", xl: "minmax(0, 1fr) 420px" } : "1fr",
        }}
      >
        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "flex-start" } }}
              >
                <Box>
                  <Typography variant="h5">Secuencia de tareas</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Continuidad del flow de principio a fin.
                  </Typography>
                </Box>

                <Stack spacing={0.9} sx={{ alignItems: { xs: "flex-start", md: "flex-end" } }}>
                  {linkedRequirements.length > 0 && (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: { md: "flex-end" }, alignItems: "center" }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {linkedRequirementLabel}
                      </Typography>
                      {linkedRequirements.slice(0, 2).map((item) => (
                        <Chip
                          key={item.id}
                          size="small"
                          variant="outlined"
                          label={item.descripcion?.trim() || `Req ${item.id.slice(0, 8)}`}
                        />
                      ))}
                      {linkedRequirements.length > 2 && (
                        <Chip size="small" variant="outlined" label={`+${linkedRequirements.length - 2}`} />
                      )}
                    </Stack>
                  )}

                  <Button variant="text" size="small" color="inherit" onClick={handleOpenLinkRequirement}>
                    {linkedRequirements.length > 0 ? "Gestionar" : "Asociar requerimiento"}
                  </Button>
                </Stack>
              </Stack>

              <WorkflowGraph
                variant="vertical"
                triggerLabel={getPrimaryRequirementLabel()}
                steps={workflow.steps}
                workflowClosed={workflow.estado === "finalizado"}
                selectedStepId={selectedStepId}
                onSelectStep={handleSelectStep}
                onOpenStep={handleOpenStep}
                onCompleteStepIntent={handleOpenCompleteStep}
                onOpenTrigger={() => {
                  const requirementId = workflow.trigger_id ?? workflow.requirement_ids[0];
                  if (requirementId) navigate(`/requirements/${requirementId}`);
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {selectedStep && (
          <Box sx={{ display: panelOpen ? "block" : "none" }}>
            <StepDetailPanel
              workflowId={workflow.id}
              step={selectedStep}
              comments={stepComments}
              history={stepHistory}
              drawer
              error={panelError}
              onClose={() => setPanelOpen(false)}
              onStepUpdated={handleStepUpdated}
              onSubmitJournal={handleSubmitJournal}
              onCompleteTask={handleCompleteTask}
              onRegisterExternalEvent={(input) => handleRegisterExternalEvent(selectedStep.id, input)}
              onResolveExternalResponse={(stepId, input) => handleResolveExternalResponse(stepId, input)}
            />
            <CompleteStepDialog
              open={pendingCompleteDialogStepId !== null}
              step={workflow.steps.find(s => s.id === pendingCompleteDialogStepId) ?? null}
              onClose={() => setPendingCompleteDialogStepId(null)}
              onSubmit={handleCompleteTask}
            />
          </Box>
        )}
      </Box>

      <Dialog open={linkRequirementOpen} onClose={managingRequirementsBusy ? undefined : handleCloseLinkRequirement} fullWidth maxWidth="sm">
        <DialogTitle>{linkedRequirements.length > 0 ? "Gestionar requerimientos" : "Asociar requerimiento"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {linkedRequirements.length > 0 && (
              <Stack spacing={0.9}>
                <Typography variant="subtitle2" color="text.secondary">
                  Requerimientos vinculados
                </Typography>
                <Stack spacing={0.9}>
                  {linkedRequirements.map((item) => (
                    <Stack
                      key={`linked-${item.id}`}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        label={item.descripcion?.trim() || `Req ${item.id.slice(0, 8)}`}
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={() =>
                          void handleUnlinkRequirement(
                            item.id,
                            item.descripcion?.trim() || `Req ${item.id.slice(0, 8)}`
                          )
                        }
                        disabled={managingRequirementsBusy}
                      >
                        {unlinkingRequirementId === item.id ? "Desvinculando..." : "Desvincular"}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}

            {linkedRequirements.length > 0 && (
              <Divider flexItem />
            )}

            <Stack spacing={0.9}>
              <Typography variant="subtitle2" color="text.secondary">
                Asociar otro requerimiento
              </Typography>

            {availableRequirements.length === 0 ? (
              <Alert severity="info">No hay requerimientos disponibles para asociar.</Alert>
            ) : (
              <TextField
                select
                fullWidth
                label="Requerimiento"
                value={linkRequirementId}
                onChange={(event) => setLinkRequirementId(event.target.value)}
              >
                {availableRequirements.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.descripcion?.trim() || `Req ${item.id.slice(0, 8)}`}
                  </MenuItem>
                ))}
              </TextField>
            )}
            </Stack>

            {linkRequirementError && <Alert severity="error">{linkRequirementError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={handleCloseLinkRequirement} disabled={managingRequirementsBusy}>
            Cerrar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleLinkRequirement()}
            disabled={managingRequirementsBusy || availableRequirements.length === 0 || !linkRequirementId}
          >
            {linkingRequirement ? "Asociando..." : "Asociar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
