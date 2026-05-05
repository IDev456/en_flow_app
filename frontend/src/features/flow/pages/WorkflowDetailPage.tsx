import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  addStepComment,
  completeStep,
  getStepComments,
  getTrigger,
  getWorkflow,
  getStepHistory,
  registerExternalEvent,
  resolveExternalResponse,
  updateStepStatus,
} from "../api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [captureToastOpen, setCaptureToastOpen] = useState(Boolean((location.state as { toast?: string } | null)?.toast));
  const captureToastMessage = (location.state as { toast?: string } | null)?.toast;

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
      const workflowData = await getWorkflow(workflowId);
      setWorkflow(workflowData);
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
              onSubmitJournal={handleSubmitJournal}
              onCompleteTask={handleCompleteTask}
              openCompleteDialog={pendingCompleteDialogStepId !== null && pendingCompleteDialogStepId === selectedStepId}
              onCompleteDialogOpened={handleCompleteDialogOpened}
              onRegisterExternalEvent={(input) => handleRegisterExternalEvent(selectedStep.id, input)}
              onResolveExternalResponse={(stepId, input) => handleResolveExternalResponse(stepId, input)}
            />
          </Box>
        )}
      </Box>
    </Stack>
  );
}
