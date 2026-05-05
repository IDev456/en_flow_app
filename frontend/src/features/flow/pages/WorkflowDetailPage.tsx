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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

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
import { WorkflowVariantSwitcher, type WorkflowVariant } from "../components/WorkflowVariantSwitcher";
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
  const [allRequirements, setAllRequirements] = useState<TriggerDetail[]>([]);
  const [linkRequirementId, setLinkRequirementId] = useState("");
  const [newRequirementDescription, setNewRequirementDescription] = useState("");

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Flow sin requerimiento";
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
      setPanelError(err instanceof Error ? err.message : "No se pudo cargar la bitacora de la tarea");
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

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? workflow.steps[0] ?? null;
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
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/requirements">
          Requerimientos
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
                  Tareas activas: {workflow.pasos_activos.length > 0 ? workflow.pasos_activos.join(", ") : "sin tareas activas"}
                </Typography>
              </Stack>
            )}

            <Stack spacing={1.25}>
              <Typography variant="subtitle2" color="text.secondary">
                Requerimientos vinculados
              </Typography>
              {workflow.requirement_ids.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Este flow todavia no esta vinculado a requerimientos.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {workflow.requirement_ids.map((requirementId) => {
                    const requirement = allRequirements.find((item) => item.id === requirementId);
                    return (
                      <Button
                        key={requirementId}
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() => navigate(`/requirements/${requirementId}`)}
                        sx={{ textTransform: "none" }}
                      >
                        {requirement?.descripcion?.trim() || `Req ${requirementId.slice(0, 8)}`}
                      </Button>
                    );
                  })}
                </Stack>
              )}

              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  select
                  label="Vincular a requerimiento"
                  value={linkRequirementId}
                  onChange={(event) => setLinkRequirementId(event.target.value)}
                  SelectProps={{ native: true }}
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
                  <Typography variant="h5">Tareas</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Selecciona una tarea para ver su detalle, registrar avance, adjuntar evidencia o cambiar su estado.
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
            onRegisterExternalEvent={(input) => handleRegisterExternalEvent(selectedStep.id, input)}
            onResolveExternalResponse={(stepId, input) => handleResolveExternalResponse(stepId, input)}
          />
        )}
      </Box>
    </Stack>
  );
}
