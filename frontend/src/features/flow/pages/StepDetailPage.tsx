import { useEffect, useState } from "react";
import { Alert, Breadcrumbs, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";

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
      return;
    }

    await updateStepStatus(step.id, {
      estado: input.estado,
      usuario: DEFAULT_ACTOR,
      nota: input.comentario,
      attachments: input.attachments ?? [],
    });
    await loadStepData();
  }

  async function handleCompleteTask(stepId: string, input: StepCompleteInput) {
    await completeStep(stepId, input);
    await loadStepData();
  }

  async function handleRegisterExternal(input: ExternalEventCreateInput) {
    if (!step) return;
    await registerExternalEvent(step.id, input);
    await loadStepData();
  }

  async function handleResolveExternal(stepId: string, input: ExternalResponseDecisionInput) {
    await resolveExternalResponse(stepId, input);
    await loadStepData();
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando paso...</Typography>
      </Stack>
    );
  }

  if (error && !step) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/triggers">
          Requerimientos
        </Link>
        {step && (
          <Link component={RouterLink} underline="hover" color="inherit" to={`/workflows/${step.workflow_id}`}>
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
        error={error}
        onSubmitJournal={handleSubmitJournal}
        onCompleteTask={handleCompleteTask}
        onRegisterExternalEvent={handleRegisterExternal}
        onResolveExternalResponse={handleResolveExternal}
      />
    </Stack>
  );
}
