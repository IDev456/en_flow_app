import { useEffect, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Alert, Box, Breadcrumbs, Button, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import {
  addStepComment,
  completeStep,
  getStep,
  getStepComments,
  getStepHistory,
  registerExternalEvent,
  resolveExternalResponse,
  updateStepStatus,
} from "../api";
import { navigateBackWithOrigin, withNavigationOrigin } from "../navigation";
import { StepDetailPanel } from "../components/StepDetailPanel";
import type {
  ExternalEventCreateInput,
  ExternalResponseDecisionInput,
  Step,
  StepComment,
  StepCompleteInput,
  StepHistoryEntry,
  StepJournalEntryInput,
} from "../types";
import { DEFAULT_ACTOR } from "../utils";

export function StepDetailPage() {
  const { stepId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [step, setStep] = useState<Step | null>(null);
  const [comments, setComments] = useState<StepComment[]>([]);
  const [history, setHistory] = useState<StepHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStepData();
  }, [stepId]);

  async function loadStepData() {
    try {
      setLoading(true);
      setError(null);
      const [stepData, commentsData, historyData] = await Promise.all([
        getStep(stepId),
        getStepComments(stepId),
        getStepHistory(stepId),
      ]);
      setStep(stepData);
      setComments(commentsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la tarea");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    if (!step) return;

    if (!input.estado) {
      await addStepComment(step.id, {
        autor: DEFAULT_ACTOR,
        comentario: input.comentario,
        attachments: input.attachments ?? [],
      });
      await loadStepData();
      showToast("Registro guardado.", "success");
      return;
    }

    await updateStepStatus(step.id, {
      estado: input.estado,
      usuario: DEFAULT_ACTOR,
      nota: input.comentario,
      attachments: input.attachments ?? [],
    });
    await loadStepData();
    showToast("Estado actualizado.", "success");
  }

  async function handleCompleteTask(stepId: string, input: StepCompleteInput) {
    await completeStep(stepId, input);
    await loadStepData();
    showToast("Tarea completada.", "success");
  }

  async function handleRegisterExternal(input: ExternalEventCreateInput) {
    if (!step) return;
    await registerExternalEvent(step.id, input);
    await loadStepData();
    showToast("Respuesta registrada.", "success");
  }

  async function handleResolveExternal(stepId: string, input: ExternalResponseDecisionInput) {
    await resolveExternalResponse(stepId, input);
    await loadStepData();
    showToast("Tarea resuelta.", "success");
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando tarea...</Typography>
      </Stack>
    );
  }

  if (error && !step) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() =>
            navigateBackWithOrigin(navigate, location.state, step?.workflow_id ? `/workflows/${step.workflow_id}` : "/flows")
          }
        >
          Volver
        </Button>
      </Box>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/flows">
          Flows
        </Link>
        {step && (
          <Link
            component={RouterLink}
            underline="hover"
            color="inherit"
            to={`/workflows/${step.workflow_id}`}
            state={withNavigationOrigin(location, "/flows")}
          >
            Flow
          </Link>
        )}
        <Typography color="text.primary">Tarea</Typography>
      </Breadcrumbs>

      <StepDetailPanel
        workflowId={step?.workflow_id ?? ""}
        step={step}
        comments={comments}
        history={history}
        standalone
        showStandaloneBack={false}
        error={error}
        onSubmitJournal={handleSubmitJournal}
        onCompleteTask={handleCompleteTask}
        onRegisterExternalEvent={handleRegisterExternal}
        onResolveExternalResponse={handleResolveExternal}
      />
    </Stack>
  );
}
