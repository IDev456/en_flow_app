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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";

import {
  addStepComment,
  completeStep,
  createRequirementFromFlow,
  getStepComments,
  getWorkflow,
  getStepHistory,
  linkWorkflowRequirement,
  listTriggers,
  registerExternalEvent,
  resolveExternalResponse,
  unlinkWorkflowRequirement,
  updateStep,
  updateStepDate,
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
import { buildJournalItems, DEFAULT_ACTOR } from "../utils";

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
  const [linkRequirementMode, setLinkRequirementMode] = useState<"existing" | "new">("existing");
  const [linkRequirementId, setLinkRequirementId] = useState("");
  const [newRequirementDescription, setNewRequirementDescription] = useState("");
  const [newRequirementRequester, setNewRequirementRequester] = useState("");
  const [linkRequirementError, setLinkRequirementError] = useState<string | null>(null);
  const [linkingRequirement, setLinkingRequirement] = useState(false);
  const [creatingRequirement, setCreatingRequirement] = useState(false);
  const [unlinkingRequirementId, setUnlinkingRequirementId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(Boolean(initialToastMessage));
  const [toastMessage, setToastMessage] = useState<string | null>(initialToastMessage);

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Flow sin proyecto";
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
      setStepComments([]);
      setStepHistory([]);
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
      await refreshAfterStepChange(selectedStepId);
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

  async function ensureCompletionCommentVisible(stepId: string, comentario: string | null | undefined, autor: string) {
    const trimmedComment = comentario?.trim();
    if (!trimmedComment) {
      return;
    }

    const [existingComments, existingHistory] = await Promise.all([getStepComments(stepId), getStepHistory(stepId)]);
    const alreadyVisibleInComments = existingComments.some((entry) => (entry.comentario ?? "").trim() === trimmedComment);
    const alreadyVisibleInHistory = existingHistory.some((entry) => (entry.nota ?? "").trim() === trimmedComment);

    if (alreadyVisibleInComments || alreadyVisibleInHistory) {
      return;
    }

    await addStepComment(stepId, {
      autor,
      comentario: trimmedComment,
      attachments: [],
    });
  }

  async function handleCompleteTask(stepId: string, input: StepCompleteInput) {
    try {
      const step = workflow?.steps.find(s => s.id === stepId);
      if (!step) return;
      const trimmedComment = input.comentario?.trim() || null;

      if (step.estado === "esperando_respuesta") {
        if (input.transition_type === "wait_external") {
          throw new Error("Una tarea en espera externa solo puede crear próxima tarea o finalizar el flow.");
        }

        // Registrar automáticamente un evento externo con el comentario del modal
        const externalComment = trimmedComment || "Respuesta externa registrada desde completar tarea";
        await registerExternalEvent(stepId, {
          event_type: "respuesta_externa_recibida",
          comentario: externalComment,
          source: "manual",
          registrado_por: input.usuario,
          attachments: input.attachments,
        });

        // Luego resolver con transition permitida
        const transitionType: "next_task" | "finish_flow" = input.transition_type as "next_task" | "finish_flow";
        await resolveExternalResponse(stepId, {
          usuario: input.usuario,
          resultado_cierre: input.resultado_cierre ?? "Completado tras espera externa",
          comentario: input.comentario ?? externalComment,
          transition_type: transitionType,
          next_task: input.next_task,
          finish_data: input.finish_data,
          attachments: input.attachments,
        });

        await ensureCompletionCommentVisible(stepId, trimmedComment, input.usuario);
      } else {
        // Flujo estandar para tareas activas, en pausa o con problema
        await completeStep(stepId, input);
        await ensureCompletionCommentVisible(stepId, trimmedComment, input.usuario);
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
    setPendingCompleteDialogStepId(stepId);
  }

  async function handleStepUpdated(step: Step) {
    await refreshAfterStepChange(step.id);
  }

  async function handleUpdateStepReminderDate(stepId: string, dateInput: string) {
    const nextValue = dateInput.trim();
    const isoValue = nextValue ? `${nextValue}T00:00:00Z` : null;

    try {
      await updateStepDate(stepId, { fecha_vencimiento: isoValue });
      await refreshAfterStepChange(stepId);
      showToast("Fecha actualizada", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la fecha";
      showToast(message, "error");
      throw err;
    }
  }

  async function handleRenameStep(step: Step, nextName: string) {
    const previousName = step.nombre.trim();
    const sanitizedName = nextName.trim();

    if (!sanitizedName) {
      throw new Error("El nombre no puede estar vacío.");
    }
    if (sanitizedName === previousName) {
      return;
    }

    await updateStep(step.id, { nombre: sanitizedName });

    const refreshedHistory = await getStepHistory(step.id);
    const historyTracksNameChange = refreshedHistory.some((entry) => {
      const field = entry.campo.trim().toLowerCase();
      const previousValue = (entry.valor_anterior ?? "").trim();
      const newValue = (entry.valor_nuevo ?? "").trim();
      const fieldSuggestsName = field.includes("nombre") || field.includes("name") || field.includes("title");
      const valuesMatch = previousValue === previousName && newValue === sanitizedName;
      return (fieldSuggestsName && newValue === sanitizedName) || valuesMatch;
    });

    if (!historyTracksNameChange) {
      await addStepComment(step.id, {
        autor: DEFAULT_ACTOR,
        comentario: `Nombre actualizado: "${previousName}" → "${sanitizedName}"`,
        attachments: [],
      });
    }

    await refreshAfterStepChange(step.id);
    showToast("Nombre de la tarea actualizado.", "success");
  }

  function handleOpenLinkRequirement() {
    if (!workflow) return;
    const linkedRequirementIds = new Set([
      ...(workflow.requirement_ids ?? []),
      ...(workflow.trigger_id ? [workflow.trigger_id] : []),
    ]);
    const nextRequirementId = requirements.find((item) => !linkedRequirementIds.has(item.id))?.id ?? "";
    const hasAvailableRequirements = Boolean(nextRequirementId);
    setLinkRequirementError(null);
    setLinkRequirementMode(hasAvailableRequirements ? "existing" : "new");
    setLinkRequirementId(nextRequirementId);
    setNewRequirementDescription("");
    setNewRequirementRequester("");
    setLinkRequirementOpen(true);
  }

  function handleCloseLinkRequirement() {
    setLinkRequirementOpen(false);
    setLinkRequirementError(null);
    setLinkRequirementMode("existing");
    setLinkRequirementId("");
    setNewRequirementDescription("");
    setNewRequirementRequester("");
  }

  async function handleLinkRequirement() {
    if (!workflow || !linkRequirementId) {
      setLinkRequirementError("Selecciona un proyecto para vincular.");
      return;
    }

    try {
      setLinkingRequirement(true);
      setLinkRequirementError(null);
      await linkWorkflowRequirement(workflow.id, { requirement_id: linkRequirementId });
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Proyecto asociado.");
      setToastOpen(true);
      handleCloseLinkRequirement();
    } catch (err) {
      setLinkRequirementError(err instanceof Error ? err.message : "No se pudo asociar el proyecto");
    } finally {
      setLinkingRequirement(false);
    }
  }

  async function handleCreateAndLinkRequirement() {
    if (!workflow) return;

    const description = newRequirementDescription.trim();
    if (!description) {
      setLinkRequirementError("Ingresá una descripción para el proyecto.");
      return;
    }

    try {
      setCreatingRequirement(true);
      setLinkRequirementError(null);
      await createRequirementFromFlow(workflow.id, {
        descripcion: description,
        solicitante: newRequirementRequester.trim() || null,
        creado_por: DEFAULT_ACTOR,
      });
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Proyecto creado y asociado.");
      setToastOpen(true);
      handleCloseLinkRequirement();
    } catch (err) {
      setLinkRequirementError(err instanceof Error ? err.message : "No se pudo crear y asociar el proyecto");
    } finally {
      setCreatingRequirement(false);
    }
  }

  async function handleUnlinkRequirement(requirementId: string, requirementLabel: string) {
    if (!workflow) return;

    const confirmed = window.confirm(
      `¿Desvincular este proyecto del flow?\n\n${requirementLabel}\n\nEl proyecto y el flow seguirán existiendo. Solo se quitará la asociación.`
    );
    if (!confirmed) return;

    try {
      setUnlinkingRequirementId(requirementId);
      setLinkRequirementError(null);
      await unlinkWorkflowRequirement(workflow.id, requirementId);
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Proyecto desvinculado.");
      setToastOpen(true);
      handleCloseLinkRequirement();
    } catch (err) {
      setLinkRequirementError(err instanceof Error ? err.message : "No se pudo desvincular el proyecto");
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
  const selectedStepJournalItems = buildJournalItems(stepHistory, stepComments).filter(
    (item) => item.body.trim().length > 0 || item.attachments.length > 0
  );
  const selectedStepHasRecords = selectedStepJournalItems.length > 0;
  const stepHasRecords = selectedStepId ? { [selectedStepId]: selectedStepHasRecords } : undefined;
  const linkedRequirementIds = new Set([...(workflow.requirement_ids ?? []), ...(workflow.trigger_id ? [workflow.trigger_id] : [])]);
  const linkedRequirements = requirements.filter(
    (item) => linkedRequirementIds.has(item.id) || item.workflow_ids.includes(workflow.id)
  );
  const availableRequirements = requirements.filter((item) => !linkedRequirements.some((linked) => linked.id === item.id));
  const linkedRequirementLabel = linkedRequirements.length === 1 ? "Proyecto asociado" : "Proyectos asociados";
  const managingRequirementsBusy = linkingRequirement || creatingRequirement || unlinkingRequirementId !== null;

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

                <Box
                  sx={{
                    minWidth: { xs: "100%", md: 280 },
                    maxWidth: { xs: "100%", md: 480 },
                    alignSelf: { xs: "stretch", md: "flex-start" },
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {linkedRequirements.length > 0 ? linkedRequirementLabel : "Sin proyectos asociados"}
                  </Typography>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={0.75}
                    sx={{
                      mt: 0.5,
                      justifyContent: { md: "flex-end" },
                      alignItems: { xs: "stretch", md: "center" },
                      flexWrap: "wrap",
                      rowGap: 0.75,
                    }}
                  >
                    {linkedRequirements.slice(0, 2).map((item) => (
                      <Chip
                        key={item.id}
                        size="small"
                        variant="outlined"
                        label={item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`}
                        sx={{
                          maxWidth: { xs: "100%", md: 260 },
                          "& .MuiChip-label": {
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        }}
                      />
                    ))}
                    {linkedRequirements.length > 2 && <Chip size="small" variant="outlined" label={`+${linkedRequirements.length - 2}`} />}
                    <Button variant="text" size="small" color="inherit" onClick={handleOpenLinkRequirement}>
                      {linkedRequirements.length > 0 ? "Gestionar" : "Asociar"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>

              <WorkflowGraph
                variant="vertical"
                triggerLabel={getPrimaryRequirementLabel()}
                steps={workflow.steps}
                workflowClosed={workflow.estado === "finalizado"}
                selectedStepId={selectedStepId}
                stepHasRecords={stepHasRecords}
                onSelectStep={handleSelectStep}
                onOpenStep={handleOpenStep}
                onCompleteStepIntent={handleOpenCompleteStep}
                onRenameStep={handleRenameStep}
                onUpdateStepReminderDate={handleUpdateStepReminderDate}
                onOpenTrigger={() => {
                  const requirementId = workflow.trigger_id ?? workflow.requirement_ids[0];
                  if (requirementId) navigate(`/requirements/${requirementId}`);
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        {selectedStep && panelOpen && (
          <Box>
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
          </Box>
        )}
      </Box>

      <CompleteStepDialog
        open={pendingCompleteDialogStepId !== null}
        step={workflow.steps.find((step) => step.id === pendingCompleteDialogStepId) ?? null}
        onClose={() => setPendingCompleteDialogStepId(null)}
        onSubmit={handleCompleteTask}
      />

      <Dialog open={linkRequirementOpen} onClose={managingRequirementsBusy ? undefined : handleCloseLinkRequirement} fullWidth maxWidth="sm">
        <DialogTitle>Asociar proyecto</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {linkedRequirements.length > 0 && (
              <Stack spacing={0.9}>
                <Typography variant="subtitle2" color="text.secondary">
                  Proyectos vinculados
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
                        label={item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`}
                      />
                      <Button
                        size="small"
                        color="error"
                        onClick={() =>
                          void handleUnlinkRequirement(
                            item.id,
                            item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`
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

            <Stack spacing={1.25}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={linkRequirementMode}
                onChange={(_, value: "existing" | "new" | null) => {
                  if (!value) return;
                  setLinkRequirementMode(value);
                  setLinkRequirementError(null);
                }}
                sx={{ alignSelf: "flex-start" }}
              >
                <ToggleButton value="existing" disabled={availableRequirements.length === 0}>
                  Asociar existente
                </ToggleButton>
                <ToggleButton value="new">Crear nuevo</ToggleButton>
              </ToggleButtonGroup>

              {linkRequirementMode === "existing" ? (
                <>
                  <Typography variant="subtitle2" color="text.secondary">
                    Asociar proyecto existente
                  </Typography>
                  {availableRequirements.length === 0 ? (
                    <Alert severity="info">
                      No hay proyectos disponibles para asociar. Podés crear uno nuevo.
                    </Alert>
                  ) : (
                    <TextField
                      select
                      fullWidth
                      label="Proyecto"
                      value={linkRequirementId}
                      onChange={(event) => setLinkRequirementId(event.target.value)}
                    >
                      {availableRequirements.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" color="text.secondary">
                    Crear proyecto nuevo
                  </Typography>
                  <TextField
                    fullWidth
                    required
                    label="Descripción del proyecto *"
                    value={newRequirementDescription}
                    onChange={(event) => setNewRequirementDescription(event.target.value)}
                  />
                  <TextField
                    fullWidth
                    label="Solicitante (opcional)"
                    value={newRequirementRequester}
                    onChange={(event) => setNewRequirementRequester(event.target.value)}
                  />
                </>
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
            onClick={() =>
              void (linkRequirementMode === "existing" ? handleLinkRequirement() : handleCreateAndLinkRequirement())
            }
            disabled={
              managingRequirementsBusy ||
              (linkRequirementMode === "existing"
                ? availableRequirements.length === 0 || !linkRequirementId
                : !newRequirementDescription.trim())
            }
          >
            {linkRequirementMode === "existing"
              ? linkingRequirement
                ? "Asociando..."
                : "Asociar"
              : creatingRequirement
                ? "Creando..."
                : "Crear y asociar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
