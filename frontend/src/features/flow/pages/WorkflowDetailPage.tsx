import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import {
  addStepComment,
  completeStep,
  getStepComments,
  getStepHistory,
  getTrigger,
  getWorkflow,
  updateStepStatus,
} from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { StepDetailPanel } from "../components/StepDetailPanel";
import { WorkflowGraph } from "../components/WorkflowGraph";
import { WorkflowVariantSwitcher, type WorkflowVariant } from "../components/WorkflowVariantSwitcher";
import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput, TriggerDetail, WorkflowDetail } from "../types";
import { DEFAULT_ACTOR, formatDate } from "../utils";

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stepComments, setStepComments] = useState<StepComment[]>([]);
  const [stepHistory, setStepHistory] = useState<StepHistoryEntry[]>([]);
  const [variant, setVariant] = useState<WorkflowVariant>("vertical");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequesterLabel() {
    return trigger?.solicitante?.trim() || "Sin solicitante";
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
      const openStatuses = new Set(["activo", "espera", "problema"]);
      const nextSelectedStepId =
        preferredStepId ??
        (stepExistsInWorkflow ? selectedStepId : null) ??
        workflowData.steps.find((step) => openStatuses.has(step.estado))?.id ??
        workflowData.steps[0]?.id ??
        null;
      setSelectedStepId(nextSelectedStepId);
      setTrigger(await getTrigger(workflowData.trigger_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el workflow");
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
      setPanelError(err instanceof Error ? err.message : "No se pudo cargar la bitacora del paso");
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

    if (input.estado === "completado") {
      await completeStep(selectedStepId, {
        usuario: DEFAULT_ACTOR,
        comentario: input.comentario ?? "",
        resultado: null,
        observaciones: null,
        attachments: input.attachments ?? [],
        siguiente_paso: input.siguiente_paso
          ? {
              nombre: input.siguiente_paso.nombre,
              descripcion: input.siguiente_paso.descripcion ?? null,
            }
          : null,
        finalizar_workflow: Boolean(input.finalizar_workflow),
      });
      const currentWorkflow = await getWorkflow(workflowId);
      const nextActiveStep = currentWorkflow.steps.find((step) => ["activo", "espera", "problema"].includes(step.estado));
      await refreshAfterStepChange(nextActiveStep?.id ?? selectedStepId);
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

  function handleSelectStep(stepId: string) {
    setSelectedStepId(stepId);
  }

  function handleOpenStep(stepId: string) {
    setSelectedStepId(stepId);
    setPanelOpen(true);
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando workflow...</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!workflow) {
    return <Alert severity="info">Workflow no encontrado.</Alert>;
  }

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? workflow.steps[0] ?? null;
  const openSteps = workflow.steps.filter((step) => ["activo", "espera", "problema"].includes(step.estado));
  const workflowHeaderStatus =
    workflow.estado === "en_proceso"
      ? (openSteps.some((step) => step.estado === "espera" || step.estado === "problema")
          ? "espera"
          : openSteps[0]?.estado ?? workflow.estado)
      : workflow.estado;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/triggers">
          Requerimientos
        </Link>
        <Link component={RouterLink} underline="hover" color="inherit" to={`/triggers/${workflow.trigger_id}`}>
          {getPrimaryRequirementLabel()}
        </Link>
        <Typography color="text.primary">Workflow</Typography>
      </Breadcrumbs>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography variant="h3">{getPrimaryRequirementLabel()}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Solicitante: {getSecondaryRequesterLabel()}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <StatusBadge value={workflowHeaderStatus} />
              </Stack>
            </Stack>

            {(workflow.fecha_inicio || workflow.fecha_fin || workflow.objetivo_final) && (
              <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 0.5, md: 2 }} sx={{ color: "text.secondary" }}>
                {workflow.fecha_inicio && (
                  <Typography variant="body2">Inicio: {formatDate(workflow.fecha_inicio)}</Typography>
                )}
                {workflow.fecha_fin && <Typography variant="body2">Cierre: {formatDate(workflow.fecha_fin)}</Typography>}
                {workflow.objetivo_final && <Typography variant="body2">Objetivo: {workflow.objetivo_final}</Typography>}
                <Typography variant="body2">
                  Pasos activos: {workflow.pasos_activos.length > 0 ? workflow.pasos_activos.join(", ") : "sin pasos activos"}
                </Typography>
              </Stack>
            )}
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
        <Card sx={{ minWidth: 0 }} onPointerDown={() => panelOpen && setPanelOpen(false)}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
              >
                <Box>
                  <Typography variant="h5">Pasos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Selecciona un paso para ver su detalle, dejar comentarios, adjuntar evidencia o cambiar su estado.
                  </Typography>
                </Box>
                <WorkflowVariantSwitcher value={variant} onChange={setVariant} />
              </Stack>

              <WorkflowGraph
                variant={variant}
                triggerLabel={getPrimaryRequirementLabel()}
                steps={workflow.steps}
                workflowClosed={workflow.estado === "finalizado"}
                selectedStepId={selectedStepId}
                onSelectStep={handleSelectStep}
                onOpenStep={handleOpenStep}
                onOpenTrigger={() => navigate(`/triggers/${workflow.trigger_id}`)}
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
          />
        )}
      </Box>
    </Stack>
  );
}
