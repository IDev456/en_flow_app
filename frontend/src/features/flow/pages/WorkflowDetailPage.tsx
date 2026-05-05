import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Collapse,
  CircularProgress,
  Link,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  addStepComment,
  completeStep,
  createRequirementFromFlow,
  getStepComments,
  getTrigger,
  getWorkflow,
  getStepHistory,
  linkWorkflowRequirement,
  listTriggers,
  registerExternalEvent,
  resolveExternalResponse,
  unlinkWorkflowRequirement,
  updateStepStatus,
} from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { StepDetailPanel } from "../components/StepDetailPanel";
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
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingCompleteDialogStepId, setPendingCompleteDialogStepId] = useState<string | null>(null);
  const [stepComments, setStepComments] = useState<StepComment[]>([]);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [allRequirements, setAllRequirements] = useState<TriggerDetail[]>([]);
  const [linkRequirementId, setLinkRequirementId] = useState("");
  const [newRequirementDescription, setNewRequirementDescription] = useState("");
  const [captureToastOpen, setCaptureToastOpen] = useState(Boolean((location.state as { toast?: string } | null)?.toast));
  const captureToastMessage = (location.state as { toast?: string } | null)?.toast;

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Flow sin requerimiento";
  }

  function getSecondaryRequesterLabel() {
    return trigger?.solicitante?.trim() || "Sin contexto";
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

  function getPrimaryActionLabel(step: Step | null) {
    if (!step) return "Ver registro";
    if (step.estado === "esperando_respuesta") return "Registrar respuesta recibida";
    if (step.estado === "activo") return "Completar tarea";
    if (step.estado === "espera") return "Retomar tarea";
    if (step.estado === "problema") return "Registrar avance";
    return "Ver registro";
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
      const [workflowData, requirements] = await Promise.all([getWorkflow(workflowId), listTriggers()]);
      setWorkflow(workflowData);
      setAllRequirements(requirements);
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
      if (primaryRequirementId) {
        setTrigger(await getTrigger(primaryRequirementId));
      } else {
        setTrigger(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el flow");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkRequirement() {
    if (!workflow || !linkRequirementId) return;
    await linkWorkflowRequirement(workflow.id, { requirement_id: linkRequirementId });
    setLinkRequirementId("");
    await loadWorkflow();
  }

  async function handleCreateRequirement() {
    if (!workflow || newRequirementDescription.trim().length < 3) return;
    await createRequirementFromFlow(workflow.id, { descripcion: newRequirementDescription.trim() });
    setNewRequirementDescription("");
    await loadWorkflow();
  }

  async function handleUnlinkRequirement(requirementId: string) {
    if (!workflow) return;
    await unlinkWorkflowRequirement(workflow.id, requirementId);
    await loadWorkflow();
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
    await completeStep(stepId, input);
    const currentWorkflow = await getWorkflow(workflowId);
    const nextActiveStep =
      currentWorkflow.steps.find((workflowStep) => workflowStep.estado === "activo") ??
      currentWorkflow.steps.find((workflowStep) => ["espera", "problema", "esperando_respuesta"].includes(workflowStep.estado));
    await refreshAfterStepChange(nextActiveStep?.id ?? stepId);
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
    setPanelOpen(true);
    setPendingCompleteDialogStepId(stepId);
  }

  function handleCompleteDialogOpened() {
    setPendingCompleteDialogStepId(null);
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
  const openSteps = workflow.steps.filter((step) => ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado));
  const workflowHeaderStatus =
    workflow.estado === "en_proceso"
      ? (openSteps.some((step) => step.estado === "esperando_respuesta")
          ? "esperando_respuesta"
          : openSteps.some((step) => step.estado === "problema")
          ? "con_problema"
          : openSteps.some((step) => step.estado === "espera")
          ? "espera"
          : openSteps[0]?.estado ?? workflow.estado)
      : workflow.estado;

  return (
    <Stack spacing={3}>
      <Snackbar
        open={captureToastOpen}
        autoHideDuration={2600}
        onClose={() => setCaptureToastOpen(false)}
        message={captureToastMessage}
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

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Typography variant="subtitle2" color="text.secondary">
                {selectedStep && ["activo", "espera", "problema", "esperando_respuesta"].includes(selectedStep.estado) ? "Tarea actual" : "Última tarea"}
              </Typography>
              {selectedStep && <StatusBadge value={selectedStep.estado} />}
            </Stack>
            <Typography variant="h4">
              {selectedStep?.nombre ?? "Sin tareas registradas"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Último registro: {selectedStep?.ultimo_comentario?.trim() || selectedStep?.descripcion?.trim() || "Sin registros todavía"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatElapsedTime(selectedStep?.ultimo_comentario_fecha ?? selectedStep?.fecha_estado_actual ?? null) ?? "Sin movimiento reciente"}
            </Typography>
            <Box>
              <Button variant="contained" onClick={() => selectedStep && handleOpenStep(selectedStep.id)} disabled={!selectedStep}>
                {getPrimaryActionLabel(selectedStep)}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Box>
                <Typography variant="h5">{getPrimaryRequirementLabel()}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Contexto: {getSecondaryRequesterLabel()}
                </Typography>
              </Box>
              <StatusBadge value={workflowHeaderStatus} />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {workflow.requirement_ids.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin requerimientos vinculados.
                </Typography>
              ) : (
                workflow.requirement_ids.map((requirementId) => {
                  const requirement = allRequirements.find((item) => item.id === requirementId);
                  return (
                    <Button
                      key={requirementId}
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => navigate(`/requirements/${requirementId}`)}
                    >
                      {requirement?.descripcion?.trim() || `Req ${requirementId.slice(0, 8)}`}
                    </Button>
                  );
                })
              )}
            </Stack>

            <Box>
              <Button variant="text" color="inherit" onClick={() => setRequirementsExpanded((value) => !value)}>
                {requirementsExpanded ? "Ocultar gestión de requerimientos" : "Gestionar requerimientos vinculados"}
              </Button>
            </Box>

            <Collapse in={requirementsExpanded}>
              <Stack spacing={1.25}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    select
                    label="Vincular a requerimiento"
                    value={linkRequirementId}
                    onChange={(event) => setLinkRequirementId(event.target.value)}
                    slotProps={{ select: { native: true } }}
                    sx={{ minWidth: 260 }}
                  >
                    <option value="">Seleccionar...</option>
                    {allRequirements
                      .filter((item) => !workflow.requirement_ids.includes(item.id))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.descripcion?.trim() || item.id.slice(0, 8)}
                        </option>
                      ))}
                  </TextField>
                  <Button variant="outlined" color="inherit" onClick={() => void handleLinkRequirement()} disabled={!linkRequirementId}>
                    Vincular
                  </Button>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    label="Crear requerimiento relacionado"
                    value={newRequirementDescription}
                    onChange={(event) => setNewRequirementDescription(event.target.value)}
                    placeholder="Ej. Instalación grupo electrógeno"
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => void handleCreateRequirement()}
                    disabled={newRequirementDescription.trim().length < 3}
                  >
                    Crear y vincular
                  </Button>
                </Stack>
                {workflow.requirement_ids.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    {workflow.requirement_ids.map((requirementId) => (
                      <Button
                        key={`unlink-${requirementId}`}
                        size="small"
                        variant="text"
                        color="inherit"
                        onClick={() => void handleUnlinkRequirement(requirementId)}
                      >
                        Desvincular {requirementId.slice(0, 8)}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Collapse>
          </Stack>
        </CardContent>
      </Card>

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
              <Box>
                <Typography variant="h5">Secuencia de tareas</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Continuidad del flow de principio a fin.
                </Typography>
              </Box>

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

        {panelOpen && selectedStep && (
          <StepDetailPanel
            workflowId={workflow.id}
            step={selectedStep}
            comments={stepComments}
            history={stepHistory}
            drawer
            error={panelError}
            onClose={() => setPanelOpen(false)}
            onSubmitJournal={handleSubmitJournal}
            onCompleteTask={handleCompleteTask}
            openCompleteDialog={pendingCompleteDialogStepId !== null && pendingCompleteDialogStepId === selectedStepId}
            onCompleteDialogOpened={handleCompleteDialogOpened}
            onRegisterExternalEvent={(input) => handleRegisterExternalEvent(selectedStep.id, input)}
            onResolveExternalResponse={(stepId, input) => handleResolveExternalResponse(stepId, input)}
          />
        )}
      </Box>
    </Stack>
  );
}
