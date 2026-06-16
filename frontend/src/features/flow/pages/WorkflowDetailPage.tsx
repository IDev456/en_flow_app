import { useEffect, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
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
  cancelWorkflow,
  completeStep,
  createRequirementFromFlow,
  deleteWorkflow,
  getStepComments,
  getWorkflow,
  getStepHistory,
  linkWorkflowRequirement,
  listTriggers,
  reactivateWorkflow,
  registerExternalEvent,
  resolveExternalResponse,
  unlinkWorkflowRequirement,
  updateWorkflow,
  updateStep,
  updateStepComment,
  updateStepStatus,
} from "../api";
import {
  getNavigationLocationState,
  mergeNavigationState,
  navigateBackWithOrigin,
  navigateWithOrigin,
  omitNavigationStateKeys,
  withNavigationOrigin,
} from "../navigation";
import { AmbitoChip } from "../components/AmbitoChip";
import { StepDetailPanel } from "../components/StepDetailPanel";
import { CompleteStepDialog } from "../components/CompleteStepDialog";
import { WorkflowGraph } from "../components/WorkflowGraph";
import type {
  Ambito,
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
import { buildJournalItems, DEFAULT_ACTOR, getAmbitoLabel } from "../utils";

type WorkflowDetailRestoreState = {
  selectedStepId: string | null;
};

export function WorkflowDetailPage() {
  const { workflowId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = getNavigationLocationState<WorkflowDetailRestoreState>(location.state);
  const restoreState = navigationState.restore;
  const { showToast } = useToastContext();
  const initialToastMessage = typeof navigationState.toast === "string" ? navigationState.toast : null;
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [requirements, setRequirements] = useState<TriggerDetail[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(() => restoreState?.selectedStepId ?? null);
  const [stepHasRecordsById, setStepHasRecordsById] = useState<Record<string, boolean>>({});
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
  const [cancellingFlow, setCancellingFlow] = useState(false);
  const [reactivatingFlow, setReactivatingFlow] = useState(false);
  const [deletingFlow, setDeletingFlow] = useState(false);
  const [toastOpen, setToastOpen] = useState(Boolean(initialToastMessage));
  const [toastMessage, setToastMessage] = useState<string | null>(initialToastMessage);
  const [workflowAmbitoDraft, setWorkflowAmbitoDraft] = useState<Ambito>(null);
  const [editingWorkflowAmbito, setEditingWorkflowAmbito] = useState(false);
  const [workflowAmbitoConfirmOpen, setWorkflowAmbitoConfirmOpen] = useState(false);
  const [savingWorkflowAmbito, setSavingWorkflowAmbito] = useState(false);

  function getPrimaryRequirementLabel() {
    return trigger?.descripcion?.trim() || workflow?.objetivo_final?.trim() || "Flow sin proyecto";
  }

  function getLastStepId(workflowData: WorkflowDetail): string | null {
    const orderedSteps = [...workflowData.steps].sort((left, right) => right.orden - left.orden);
    return orderedSteps[0]?.id ?? null;
  }

  function handleOpenRequirement(requirementId: string) {
    navigateWithOrigin(navigate, location, `/requirements/${requirementId}`, "/flows");
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

  useEffect(() => {
    setWorkflowAmbitoDraft(workflow?.ambito ?? null);
    setEditingWorkflowAmbito(false);
    setWorkflowAmbitoConfirmOpen(false);
  }, [workflow?.id, workflow?.ambito]);

  useEffect(() => {
    if (!initialToastMessage) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: omitNavigationStateKeys(location.state, ["toast"]),
    });
  }, [initialToastMessage, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (restoreState?.selectedStepId === selectedStepId) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: mergeNavigationState(location.state, {
        restore: {
          selectedStepId,
        } satisfies WorkflowDetailRestoreState,
      }),
    });
  }, [location.pathname, location.search, location.state, navigate, restoreState, selectedStepId]);

  async function loadWorkflow(preferredStepId?: string) {
    try {
      setLoading(true);
      setError(null);
      const [workflowData, requirementData] = await Promise.all([getWorkflow(workflowId), listTriggers()]);
      const nextStepHasRecordsById = workflowData.steps.reduce<Record<string, boolean>>((accumulator, step) => {
        accumulator[step.id] = Boolean(
          step.ultimo_comentario_fecha || step.ultimo_comentario || step.resultado || step.observaciones
        );
        return accumulator;
      }, {});
      setWorkflow(workflowData);
      setRequirements(requirementData);
      setStepHasRecordsById((current) => {
        const merged = { ...nextStepHasRecordsById };
        for (const step of workflowData.steps) {
          if (current[step.id] !== undefined) {
            merged[step.id] = current[step.id] || nextStepHasRecordsById[step.id];
          }
        }
        return merged;
      });
      const selectedStepStillExists = selectedStepId
        ? workflowData.steps.some((step) => step.id === selectedStepId)
        : false;
      const preferredStepStillExists = preferredStepId
        ? workflowData.steps.some((step) => step.id === preferredStepId)
        : false;
      const nextSelectedStepId =
        (preferredStepStillExists ? preferredStepId : null) ??
        (selectedStepStillExists ? selectedStepId : null) ??
        getLastStepId(workflowData);
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
      const hasVisibleRecords = buildJournalItems(history, comments).some(
        (item) => item.body.trim().length > 0 || item.attachments.length > 0
      );
      setStepHasRecordsById((current) => ({
        ...current,
        [stepId]: current[stepId] || hasVisibleRecords,
      }));
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

  async function handleEditJournalComment(commentId: string, comentario: string | null) {
    if (!selectedStepId) return;
    await updateStepComment(selectedStepId, commentId, {
      autor: DEFAULT_ACTOR,
      comentario,
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

  function handleStepSelect(stepId: string) {
    setSelectedStepId(stepId);
  }

  function handleOpenCompleteStep(stepId: string) {
    setSelectedStepId(stepId);
    setPendingCompleteDialogStepId(stepId);
  }

  async function handleStepUpdated(step: Step) {
    await refreshAfterStepChange(step.id);
  }

  function handleStartWorkflowAmbitoEdit() {
    if (!workflow) return;
    setWorkflowAmbitoDraft(workflow.ambito);
    setWorkflowAmbitoConfirmOpen(false);
    setEditingWorkflowAmbito(true);
  }

  function handleCancelWorkflowAmbitoEdit() {
    if (!workflow) return;
    setWorkflowAmbitoDraft(workflow.ambito);
    setWorkflowAmbitoConfirmOpen(false);
    setEditingWorkflowAmbito(false);
  }

  async function performSaveWorkflowAmbito(propagateAmbito: boolean) {
    if (!workflow) return;

    try {
      setSavingWorkflowAmbito(true);
      const updated = await updateWorkflow(workflow.id, {
        ambito: workflowAmbitoDraft,
        propagate_ambito: propagateAmbito,
      });
      setWorkflow(updated);
      setWorkflowAmbitoDraft(updated.ambito);
      setEditingWorkflowAmbito(false);
      setWorkflowAmbitoConfirmOpen(false);
      setToastMessage(propagateAmbito ? "Ámbito del flow y tareas actualizado." : "Ámbito del flow actualizado.");
      setToastOpen(true);
      showToast(propagateAmbito ? "Ámbito propagado a las tareas." : "Ámbito del flow actualizado.", "success");
      await loadWorkflow(selectedStepId ?? undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el ámbito del flow";
      setLinkRequirementError(message);
      showToast(message, "error");
    } finally {
      setSavingWorkflowAmbito(false);
    }
  }

  function handleSaveWorkflowAmbito() {
    if (!workflow) return;
    if (workflowAmbitoDraft === workflow.ambito) {
      setEditingWorkflowAmbito(false);
      return;
    }
    setWorkflowAmbitoConfirmOpen(true);
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
    if (workflow.ambito === null) {
      setLinkRequirementError("Debes definir primero el ámbito del flow.");
      showToast("Debes definir primero el ámbito del flow.", "info");
      return;
    }
    const linkedRequirementIds = new Set([
      ...(workflow.requirement_ids ?? []),
      ...(workflow.trigger_id ? [workflow.trigger_id] : []),
    ]);
    const compatibleRequirements = requirements.filter(
      (item) => !linkedRequirementIds.has(item.id) && item.ambito === workflow.ambito
    );
    const nextRequirementId = compatibleRequirements[0]?.id ?? "";
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
    if (workflow.ambito === null) {
      setLinkRequirementError("Debes definir primero el ámbito del flow.");
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
    if (workflow.ambito === null) {
      setLinkRequirementError("Debes definir primero el ámbito del flow.");
      return;
    }

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

  async function handleCancelCurrentFlow() {
    if (!workflow) return;
    if (workflow.estado === "finalizado" || workflow.estado === "cancelado") return;

    const currentTask =
      workflow.steps.find((item) => ["activo", "espera", "problema", "esperando_respuesta"].includes(item.estado))?.nombre?.trim() ||
      workflow.objetivo_final?.trim() ||
      "Flow sin tarea actual";

    const confirmed = window.confirm(
      `¿Cancelar este flow?\n\n${currentTask}\n\nEl flow pasará a estado cancelado y quedará en modo solo lectura operativa.\nNo se eliminarán tareas, comentarios ni proyectos vinculados.\nPara continuar operando tareas, primero deberás reactivarlo desde la pantalla de Flows.`
    );
    if (!confirmed) return;

    try {
      setCancellingFlow(true);
      await cancelWorkflow(workflow.id);
      await loadWorkflow(selectedStepId ?? undefined);
      setPendingCompleteDialogStepId(null);
      setToastMessage("Flow cancelado.");
      setToastOpen(true);
      showToast("Flow cancelado.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cancelar el flow";
      showToast(message, "error");
    } finally {
      setCancellingFlow(false);
    }
  }

  async function handleReactivateCurrentFlow() {
    if (!workflow || workflow.estado !== "cancelado") return;

    const currentTask =
      workflow.steps.find((item) => ["activo", "espera", "problema", "esperando_respuesta"].includes(item.estado))?.nombre?.trim() ||
      workflow.objetivo_final?.trim() ||
      "Flow sin tarea actual";

    const confirmed = window.confirm(
      `Reactivar este flow?\n\n${currentTask}\n\nEl flow volvera a la operacion activa con sus tareas y proyectos vinculados intactos.`
    );
    if (!confirmed) return;

    try {
      setReactivatingFlow(true);
      await reactivateWorkflow(workflow.id);
      await loadWorkflow(selectedStepId ?? undefined);
      setToastMessage("Flow reactivado.");
      setToastOpen(true);
      showToast("Flow reactivado.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo reactivar el flow";
      showToast(message, "error");
    } finally {
      setReactivatingFlow(false);
    }
  }

  async function handleDeleteCurrentFlow() {
    if (!workflow || !["cancelado", "finalizado"].includes(workflow.estado)) return;

    const confirmed = window.confirm(
      "Eliminar este flow?\n\nEsta accion eliminara el flow, sus tareas, comentarios, historial, eventos externos y vinculos con proyectos.\n\nEsta accion no se puede deshacer."
    );
    if (!confirmed) return;

    try {
      setDeletingFlow(true);
      await deleteWorkflow(workflow.id);
      showToast("Flow eliminado.", "success");
      navigate("/flows");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el flow";
      showToast(message, "error");
    } finally {
      setDeletingFlow(false);
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

  const selectedStep: Step | null = workflow.steps.find((step) => step.id === selectedStepId) ?? null;
  const isWorkflowOperationalClosed = workflow.estado === "cancelado" || workflow.estado === "finalizado";
  const canCancelCurrent = ["en_proceso", "esperando_respuesta", "en_espera", "con_problema", "pendiente"].includes(workflow.estado);
  const canReactivateCurrent = workflow.estado === "cancelado";
  const canDeleteCurrent = ["cancelado", "finalizado"].includes(workflow.estado);
  const linkedRequirementIds = new Set([...(workflow.requirement_ids ?? []), ...(workflow.trigger_id ? [workflow.trigger_id] : [])]);
  const linkedRequirements = requirements.filter(
    (item) => linkedRequirementIds.has(item.id) || item.workflow_ids.includes(workflow.id)
  );
  const availableRequirements =
    workflow.ambito === null
      ? []
      : requirements.filter(
          (item) => !linkedRequirements.some((linked) => linked.id === item.id) && item.ambito === workflow.ambito
        );
  const linkedRequirementLabel = linkedRequirements.length === 1 ? "Proyecto asociado" : "Proyectos asociados";
  const managingRequirementsBusy = linkingRequirement || creatingRequirement || unlinkingRequirementId !== null;

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigateBackWithOrigin(navigate, location.state, "/flows")}
        >
          Volver
        </Button>
      </Box>
      <Snackbar
        open={toastOpen}
        autoHideDuration={2600}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
      />
      <Dialog
        open={workflowAmbitoConfirmOpen}
        onClose={savingWorkflowAmbito ? undefined : () => setWorkflowAmbitoConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Cambiar ámbito del flow</DialogTitle>
        <DialogContent dividers>
          ¿Querés aplicar este cambio también a las tareas?
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={() => setWorkflowAmbitoConfirmOpen(false)} disabled={savingWorkflowAmbito}>
            Cancelar
          </Button>
          <Button onClick={() => void performSaveWorkflowAmbito(false)} disabled={savingWorkflowAmbito}>
            Solo flow
          </Button>
          <Button variant="contained" onClick={() => void performSaveWorkflowAmbito(true)} disabled={savingWorkflowAmbito}>
            Aplicar a tareas
          </Button>
        </DialogActions>
      </Dialog>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/flows">
          Flows
        </Link>
        {trigger && (
          <Link
            component={RouterLink}
            underline="hover"
            color="inherit"
            to={`/requirements/${trigger.id}`}
            state={withNavigationOrigin(location, "/flows")}
          >
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
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 500px" },
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
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="body2" color="text.secondary">
                      Ámbito del flow
                    </Typography>
                    {editingWorkflowAmbito ? (
                      <>
                        <TextField
                          select
                          size="small"
                          value={workflowAmbitoDraft ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setWorkflowAmbitoDraft(value === "" ? null : (value as Exclude<Ambito, null>));
                          }}
                          sx={{ minWidth: 180 }}
                        >
                          <MenuItem value="laboral">{getAmbitoLabel("laboral")}</MenuItem>
                          <MenuItem value="personal">{getAmbitoLabel("personal")}</MenuItem>
                          <MenuItem value="">Sin definir</MenuItem>
                        </TextField>
                        <Button size="small" onClick={handleCancelWorkflowAmbitoEdit} disabled={savingWorkflowAmbito}>
                          Cancelar
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSaveWorkflowAmbito}
                          disabled={savingWorkflowAmbito}
                        >
                          Guardar
                        </Button>
                      </>
                    ) : (
                      <>
                        <AmbitoChip ambito={workflow.ambito} />
                        <Button size="small" color="inherit" onClick={handleStartWorkflowAmbitoEdit}>
                          Editar
                        </Button>
                      </>
                    )}
                  </Stack>
                  {workflow.estado === "cancelado" && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      Flow cancelado, reactivar para continuar.
                    </Alert>
                  )}
                </Box>

                <Box
                  sx={{
                    minWidth: { xs: "100%", md: 280 },
                    maxWidth: { xs: "100%", md: 480 },
                    alignSelf: { xs: "stretch", md: "flex-start" },
                  }}
                >
                  <Box
                    sx={(theme) => ({
                      border: "1px solid",
                      borderColor: theme.palette.outlineVariant,
                      borderRadius: theme.appShape.md,
                      backgroundColor: theme.palette.surfaceContainerLow,
                      px: 1.5,
                      py: 1.4,
                    })}
                  >
                    <Stack spacing={1.15}>
                      <Typography variant="caption" color="text.secondary">
                        {linkedRequirements.length > 0 ? linkedRequirementLabel : "Sin proyectos asociados"}
                      </Typography>
                      {workflow.ambito === null && (
                        <Typography variant="caption" color="warning.main">
                          Define el ámbito del flow para asociarlo con proyectos.
                        </Typography>
                      )}
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          justifyContent: "space-between",
                          alignItems: { xs: "stretch", sm: "center" },
                          gap: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            alignItems: "center",
                            flexWrap: "wrap",
                            rowGap: 0.75,
                            minHeight: 32,
                          }}
                        >
                          {linkedRequirements.slice(0, 1).map((item) => (
                            <Chip
                              key={item.id}
                              size="small"
                              variant="outlined"
                              clickable
                              label={item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`}
                              onClick={() => handleOpenRequirement(item.id)}
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
                          {linkedRequirements.length > 1 && (
                            <Chip size="small" variant="outlined" label={`+${linkedRequirements.length - 1}`} />
                          )}
                        </Stack>
                        <Button
                          variant="text"
                          size="small"
                          color="inherit"
                          onClick={handleOpenLinkRequirement}
                          disabled={workflow.ambito === null}
                          sx={{ px: 0.5, alignSelf: { xs: "flex-start", sm: "center" } }}
                        >
                          {linkedRequirements.length > 0 ? "Gestionar" : "Asociar"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              </Stack>

              <WorkflowGraph
                variant="vertical"
                steps={workflow.steps}
                workflowClosed={isWorkflowOperationalClosed}
                selectedStepId={selectedStepId}
                stepHasRecords={stepHasRecordsById}
                onStepSelect={handleStepSelect}
                onCompleteStepIntent={isWorkflowOperationalClosed ? undefined : handleOpenCompleteStep}
                onRenameStep={isWorkflowOperationalClosed ? undefined : handleRenameStep}
              />

              {(canCancelCurrent || canReactivateCurrent || canDeleteCurrent) && (
                <>
                  <Divider />
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", md: "center" },
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Acciones del flow
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        Gestioná el estado del flow sin perder tareas, registros ni proyectos vinculados.
                      </Typography>
                    </Box>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ alignSelf: { xs: "stretch", md: "center" }, width: { xs: "100%", md: "auto" } }}
                    >
                      {canCancelCurrent && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<CancelOutlinedIcon fontSize="small" />}
                          onClick={() => void handleCancelCurrentFlow()}
                          disabled={cancellingFlow || reactivatingFlow || deletingFlow}
                          sx={{ px: 1.5 }}
                        >
                          {cancellingFlow ? "Cancelando..." : "Cancelar flow"}
                        </Button>
                      )}
                      {canReactivateCurrent && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="inherit"
                          startIcon={<ReplayRoundedIcon fontSize="small" />}
                          onClick={() => void handleReactivateCurrentFlow()}
                          disabled={reactivatingFlow || cancellingFlow || deletingFlow}
                          sx={{ px: 1.5 }}
                        >
                          {reactivatingFlow ? "Reactivando..." : "Reactivar flow"}
                        </Button>
                      )}
                      {canDeleteCurrent && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                          onClick={() => void handleDeleteCurrentFlow()}
                          disabled={deletingFlow || cancellingFlow || reactivatingFlow}
                          sx={{ px: 1.5 }}
                        >
                          {deletingFlow ? "Eliminando..." : "Eliminar flow"}
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <StepDetailPanel
            workflowId={workflow.id}
            step={selectedStep}
            comments={stepComments}
            history={stepHistory}
            workflowStatus={workflow.estado}
            drawer
            error={panelError}
            onStepUpdated={handleStepUpdated}
            onSubmitJournal={handleSubmitJournal}
            onEditJournalComment={handleEditJournalComment}
            onCompleteTask={handleCompleteTask}
            onRegisterExternalEvent={
              selectedStep ? (input) => handleRegisterExternalEvent(selectedStep.id, input) : undefined
            }
            onResolveExternalResponse={
              selectedStep ? (stepId, input) => handleResolveExternalResponse(stepId, input) : undefined
            }
            operationLocked={isWorkflowOperationalClosed}
            operationLockMessage={
              workflow.estado === "cancelado"
                ? "Flow cancelado, reactivar para continuar."
                : "Flow finalizado, este paso queda en solo lectura operativa."
            }
          />
        </Box>
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
                        clickable
                        label={item.descripcion?.trim() || `Proyecto ${item.id.slice(0, 8)}`}
                        onClick={() => handleOpenRequirement(item.id)}
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
              {workflow.ambito === null && (
                <Alert severity="warning">
                  Debes definir primero el ámbito del flow para asociarlo con proyectos.
                </Alert>
              )}
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
                  {workflow.ambito === null ? (
                    <Alert severity="info">
                      Define primero el ámbito del flow para ver proyectos compatibles.
                    </Alert>
                  ) : availableRequirements.length === 0 ? (
                    <Alert severity="info">
                      No hay proyectos del mismo ámbito para asociar.
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
                  {workflow.ambito === null && (
                    <Alert severity="info">
                      El proyecto nuevo heredará el ámbito del flow una vez que lo definas.
                    </Alert>
                  )}
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
                ? workflow.ambito === null || availableRequirements.length === 0 || !linkRequirementId
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
