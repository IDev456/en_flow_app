import { useEffect, useState } from "react";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import SchemaRoundedIcon from "@mui/icons-material/SchemaRounded";
import { alpha } from "@mui/material/styles";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Slide,
  type SlideProps,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { deleteTrigger, getStepComments, getTrigger, getWorkflow, startWorkflow, updateTrigger } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail, WorkflowDetail } from "../types";
import { DEFAULT_ACTOR, formatElapsedTime } from "../utils";

const SOLICITANTE_MAX = 150;
const TRIGGER_DESCRIPTION_MAX = 1000;

function SlideUp(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newWorkflowFirstDescription, setNewWorkflowFirstDescription] = useState("");
  const [newWorkflowExecutionDate, setNewWorkflowExecutionDate] = useState("");
  const [newWorkflowError, setNewWorkflowError] = useState<string | null>(null);
  const [newWorkflowSuccess, setNewWorkflowSuccess] = useState<string | null>(null);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [workflowLatestCommentById, setWorkflowLatestCommentById] = useState<Record<string, string | null>>({});
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [deletingRequirement, setDeletingRequirement] = useState(false);
  const [editSolicitante, setEditSolicitante] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [requirementError, setRequirementError] = useState<string | null>(null);
  const [requirementToastOpen, setRequirementToastOpen] = useState(false);
  const navigate = useNavigate();

  function getPrimaryDetail(currentTrigger: TriggerDetail) {
    return currentTrigger.descripcion?.trim() || "Proyecto sin detalle";
  }

  function getSecondaryRequester(currentTrigger: TriggerDetail) {
    return currentTrigger.solicitante?.trim() || "Sin contexto";
  }

  useEffect(() => {
    void loadTrigger();
  }, [triggerId]);

  useEffect(() => {
    if (!trigger) return;
    setEditSolicitante(trigger.solicitante ?? "");
    setEditDescripcion(trigger.descripcion ?? "");
  }, [trigger?.id, trigger?.solicitante, trigger?.descripcion]);

  async function loadTrigger() {
    try {
      setLoading(true);
      setError(null);
      setNewWorkflowError(null);
      setWorkflowsError(null);
      const triggerData = await getTrigger(triggerId);
      setTrigger(triggerData);

      if (triggerData.workflow_ids.length === 0) {
        setWorkflowsById({});
        setWorkflowLatestCommentById({});
        return;
      }

      try {
        const workflowDetails = await Promise.all(triggerData.workflow_ids.map((workflowId) => getWorkflow(workflowId)));
        setWorkflowsById(Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])));

        const latestCommentEntries = await Promise.all(
          workflowDetails.map(async (workflow) => {
            const stepLatestCommentDates = await Promise.all(
              workflow.steps.map(async (step) => {
                let latestForStep = step.ultimo_comentario_fecha;

                try {
                  const comments = await getStepComments(step.id);
                  const latestFromComments = comments[comments.length - 1]?.fecha_creacion ?? null;
                  if (
                    latestFromComments &&
                    (!latestForStep || new Date(latestFromComments).getTime() > new Date(latestForStep).getTime())
                  ) {
                    latestForStep = latestFromComments;
                  }
                } catch {
                  // si falla un paso, usamos lo disponible en el snapshot del workflow
                }

                return latestForStep;
              })
            );

            const latestForWorkflow = stepLatestCommentDates.reduce<string | null>((latest, current) => {
              if (!current) return latest;
              if (!latest) return current;
              return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
            }, null);

            return [workflow.id, latestForWorkflow] as const;
          })
        );

        setWorkflowLatestCommentById(Object.fromEntries(latestCommentEntries));
      } catch {
        setWorkflowsById({});
        setWorkflowLatestCommentById({});
        setWorkflowsError("No se pudo cargar el detalle de algunos flows.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }

  function handleStartEditRequirement() {
    if (!trigger) return;
    setEditSolicitante(trigger.solicitante ?? "");
    setEditDescripcion(trigger.descripcion ?? "");
    setRequirementError(null);
    setEditingRequirement(true);
  }

  function handleCancelEditRequirement() {
    if (!trigger) return;
    setEditSolicitante(trigger.solicitante ?? "");
    setEditDescripcion(trigger.descripcion ?? "");
    setRequirementError(null);
    setEditingRequirement(false);
  }

  async function handleSaveRequirement() {
    if (!trigger) return;

    if (editSolicitante.trim().length > SOLICITANTE_MAX) {
      setRequirementError(`Contexto supera ${SOLICITANTE_MAX} caracteres`);
      return;
    }
    if (editDescripcion.trim().length > TRIGGER_DESCRIPTION_MAX) {
      setRequirementError(`Descripcion supera ${TRIGGER_DESCRIPTION_MAX} caracteres`);
      return;
    }

    try {
      setSavingRequirement(true);
      setRequirementError(null);
      const updatedTrigger = await updateTrigger(trigger.id, {
        solicitante: editSolicitante.trim() || null,
        descripcion: editDescripcion.trim() || null,
      });
      setTrigger(updatedTrigger);
      setEditingRequirement(false);
      setRequirementToastOpen(true);
    } catch (err) {
      setRequirementError(err instanceof Error ? err.message : "No se pudo actualizar el proyecto");
    } finally {
      setSavingRequirement(false);
    }
  }

  async function handleDeleteRequirement() {
    if (!trigger) return;

    if (trigger.workflow_ids.length > 0) {
      setRequirementError("No se puede eliminar este proyecto porque tiene flows vinculados. Primero desvincula los flows o déjalo como agrupador.");
      return;
    }

    const detail = trigger.descripcion?.trim() || "Proyecto sin detalle";
    const confirmed = window.confirm(
      `¿Eliminar este proyecto?\n\n${detail}\n\nEsta acción no se puede deshacer.\nSolo se eliminará si no tiene flows vinculados.`
    );
    if (!confirmed) return;

    try {
      setDeletingRequirement(true);
      setRequirementError(null);
      await deleteTrigger(trigger.id);
      navigate("/requirements", { state: { toast: "Proyecto eliminado." } });
    } catch (err) {
      setRequirementError(err instanceof Error ? err.message : "No se pudo eliminar el proyecto");
    } finally {
      setDeletingRequirement(false);
    }
  }

  async function handleCreateWorkflow() {
    if (!trigger) return;

    if (!newWorkflowFirstDescription.trim()) {
      setNewWorkflowError("Debes indicar la descripcion de la tarea inicial.");
      return;
    }

    try {
      setCreatingWorkflow(true);
      setNewWorkflowError(null);
      setNewWorkflowSuccess(null);
      const flowTitle = trigger.descripcion?.trim() || "";
      const firstStepName = flowTitle || "Tarea inicial";

      const newWorkflow = await startWorkflow(trigger.id, {
        objetivo_final: flowTitle || null,
        resolucion_esperada: "Flujo completado con validacion final",
        primer_paso: {
          nombre: firstStepName,
          descripcion: newWorkflowFirstDescription.trim(),
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null,
          fecha_ejecucion_estimada: newWorkflowExecutionDate ? `${newWorkflowExecutionDate}T00:00:00Z` : null,
        },
      });
      setNewWorkflowSuccess("Nuevo flow asociado creado.");
      setNewWorkflowFirstDescription("");
      setNewWorkflowExecutionDate("");
      await loadTrigger();
      navigate(`/workflows/${newWorkflow.id}`);
    } catch (err) {
      setNewWorkflowError(err instanceof Error ? err.message : "No se pudo crear el nuevo flow");
    } finally {
      setCreatingWorkflow(false);
    }
  }

  function getWorkflowActiveStep(workflow: WorkflowDetail) {
    if (workflow.paso_actual !== null) {
      const byOrder = workflow.steps.find((s) => s.orden === workflow.paso_actual);
      if (byOrder) return byOrder;
    }
    return workflow.steps.find((s) => !["completado", "cancelada"].includes(s.estado)) ?? null;
  }

  function getLatestWorkflowMovementAt(workflow: WorkflowDetail) {
    return workflow.steps.reduce<string | null>((latest, step) => {
      if (!latest) return step.fecha_estado_actual;
      return new Date(step.fecha_estado_actual).getTime() > new Date(latest).getTime() ? step.fecha_estado_actual : latest;
    }, null);
  }

  function getWorkflowDisplayStatus(workflow: WorkflowDetail) {
    if (workflow.estado === "esperando_respuesta") {
      return "esperando_respuesta";
    }
    if (workflow.estado === "en_espera") {
      return "en_espera";
    }
    if (workflow.estado === "con_problema") {
      return "con_problema";
    }
    if (workflow.estado === "finalizado" || workflow.estado === "cancelado") {
      return workflow.estado;
    }
    if (workflow.steps.some((step) => step.estado === "espera" || step.estado === "problema")) {
      return "espera";
    }
    return workflow.estado;
  }

  function countExternalWaitingSteps(workflow: WorkflowDetail) {
    return workflow.steps.filter((step) => step.estado === "esperando_respuesta").length;
  }

  const linkedWorkflows = (trigger?.workflow_ids ?? [])
    .map((workflowId) => workflowsById[workflowId])
    .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));
  const canDeleteRequirement = (trigger?.workflow_ids.length ?? 0) === 0;
  const requirementStats = {
    abiertos: linkedWorkflows.filter((workflow) =>
      ["en_proceso", "en_espera", "con_problema", "pendiente"].includes(workflow.estado)
    ).length,
    esperando: linkedWorkflows.filter((workflow) => workflow.estado === "esperando_respuesta").length,
    finalizados: linkedWorkflows.filter((workflow) => ["finalizado", "cancelado"].includes(workflow.estado)).length,
  };

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando proyecto...</Typography>
      </Stack>
    );
  }

  if (error && !trigger) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!trigger) {
    return <Alert severity="info">Proyecto no encontrado.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Snackbar
        open={requirementToastOpen}
        autoHideDuration={2600}
        onClose={() => setRequirementToastOpen(false)}
        message="Proyecto actualizado."
        slots={{ transition: SlideUp }}
      />
      <Breadcrumbs separator="›" aria-label="breadcrumb" sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.75 } }}>
        <Link component={RouterLink} underline="hover" color="text.secondary" to="/requirements" sx={{ typography: "caption" }}>
          Proyectos
        </Link>
        <Typography color="text.primary" variant="caption">Detalle</Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(320px, 0.9fr)" },
        }}
      >
        <Card
          sx={{
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
            background: (theme) =>
              theme.palette.mode === "dark"
                ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 58%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 52%, ${alpha(theme.palette.background.default, 0.98)} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" color="primary.light" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                    Proyecto
                  </Typography>
                  {editingRequirement ? (
                    <Stack spacing={1.25} sx={{ mt: 1 }}>
                      <TextField
                        label="Descripcion"
                        multiline
                        minRows={3}
                        value={editDescripcion}
                        onChange={(event) => setEditDescripcion(event.target.value.slice(0, TRIGGER_DESCRIPTION_MAX))}
                        disabled={savingRequirement}
                      />
                      <TextField
                        label="Contexto"
                        value={editSolicitante}
                        onChange={(event) => setEditSolicitante(event.target.value.slice(0, SOLICITANTE_MAX))}
                        disabled={savingRequirement}
                      />
                    </Stack>
                  ) : (
                    <>
                      <Typography variant="h3">{getPrimaryDetail(trigger)}</Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Contexto: {getSecondaryRequester(trigger)}
                      </Typography>
                    </>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <StatusBadge value={trigger.estado_general} />
                  {editingRequirement ? (
                    <>
                      <Button variant="text" color="inherit" onClick={handleCancelEditRequirement} disabled={savingRequirement || deletingRequirement}>
                        Cancelar
                      </Button>
                      <Button variant="contained" onClick={() => void handleSaveRequirement()} disabled={savingRequirement || deletingRequirement}>
                        {savingRequirement ? "Guardando..." : "Guardar"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outlined" color="inherit" onClick={handleStartEditRequirement} disabled={deletingRequirement}>
                        Editar proyecto
                      </Button>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => void handleDeleteRequirement()}
                        disabled={deletingRequirement || !canDeleteRequirement}
                      >
                        {deletingRequirement ? "Eliminando..." : "Eliminar proyecto"}
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>
              {requirementError && <Alert severity="error">{requirementError}</Alert>}
              {!editingRequirement && !canDeleteRequirement && (
                <Typography variant="caption" color="text.secondary">
                  No se puede eliminar porque tiene flows vinculados.
                </Typography>
              )}

              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" variant="outlined" label={`${linkedWorkflows.length} flows`} />
                {requirementStats.abiertos > 0 && (
                  <Chip size="small" variant="filled" color="info" label={`${requirementStats.abiertos} activos`} />
                )}
                {requirementStats.esperando > 0 && (
                  <Chip size="small" variant="filled" color="warning" label={`${requirementStats.esperando} esperando`} />
                )}
                {requirementStats.finalizados > 0 && (
                  <Chip size="small" variant="filled" color="success" label={`${requirementStats.finalizados} cerrados`} />
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2}>
              <Stack spacing={0.75}>
                <Typography variant="h5">Flows asociados</Typography>
                <Typography variant="caption" color="text.secondary">
                  Crea y consulta flows vinculados a este proyecto.
                </Typography>
              </Stack>

              {trigger.workflow_activo_id ? (
                <Stack spacing={2}>
                  <Alert severity="info">Hay al menos un flow activo asociado a este requerimiento.</Alert>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Typography color="text.secondary">No hay flow activo en este momento.</Typography>
                </Stack>
              )}

              <Stack spacing={1.25}>
                <Typography variant="subtitle2" color="text.secondary">
                  Crear nuevo flow asociado
                </Typography>
                <TextField
                  label="Descripción de la tarea inicial *"
                  multiline
                  minRows={3}
                  value={newWorkflowFirstDescription}
                  onChange={(event) => setNewWorkflowFirstDescription(event.target.value)}
                  disabled={creatingWorkflow}
                />
                <TextField
                  label="Fecha"
                  type="date"
                  value={newWorkflowExecutionDate}
                  onChange={(event) => setNewWorkflowExecutionDate(event.target.value)}
                  helperText="Posible fecha de ejecución"
                  disabled={creatingWorkflow}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<PlayCircleOutlineRoundedIcon />}
                  onClick={() => void handleCreateWorkflow()}
                  disabled={creatingWorkflow}
                >
                  {creatingWorkflow ? "Creando flow..." : "Crear nuevo flow"}
                </Button>
                {newWorkflowError && <Alert severity="error">{newWorkflowError}</Alert>}
                {newWorkflowSuccess && <Alert severity="success">{newWorkflowSuccess}</Alert>}
              </Stack>

              {trigger.workflow_ids.length > 0 && (
                <Stack spacing={1.25}>
                  <Typography variant="h6">Flows del proyecto</Typography>
                  {workflowsError && <Alert severity="warning">{workflowsError}</Alert>}
                  <Stack spacing={1}>
                    {trigger.workflow_ids.map((workflowId) => {
                      const workflow = workflowsById[workflowId];
                      const currentStep = workflow ? getWorkflowActiveStep(workflow) : null;
                      const totalSteps = workflow?.steps.length ?? 0;
                      const commentElapsed = formatElapsedTime(workflowLatestCommentById[workflowId] ?? null);
                      return (
                        <Button
                          key={workflowId}
                          component={RouterLink}
                          to={`/workflows/${workflowId}`}
                          variant="outlined"
                          color="inherit"
                          sx={{
                            justifyContent: "flex-start",
                            alignItems: "stretch",
                            textTransform: "none",
                            borderRadius: 2,
                            py: 1.6,
                            px: 1.8,
                            borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                            backgroundColor: (theme) =>
                              alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.22 : 0.7),
                          }}
                        >
                          <Stack direction="row" spacing={1.4} sx={{ alignItems: "flex-start", minWidth: 0, width: "100%" }}>
                            <SchemaRoundedIcon sx={{ mt: 0.15, color: "primary.light" }} />
                            <Stack spacing={0.5} sx={{ minWidth: 0, textAlign: "left", width: "100%" }}>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
                              >
                                <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
                                  {currentStep?.nombre ??
                                    (workflow?.estado === "finalizado" ? "Completado" :
                                     workflow?.estado === "cancelado" ? "Cancelado" : "Sin tarea activa")}
                                </Typography>
                                {workflow && <StatusBadge value={getWorkflowDisplayStatus(workflow)} />}
                              </Stack>
                              {workflow ? (
                                <>
                                  <Typography variant="caption" color="text.secondary">
                                    {currentStep ? `Paso ${currentStep.orden} de ${totalSteps}` : `${totalSteps} tareas`}
                                  </Typography>
                                  {countExternalWaitingSteps(workflow) > 0 && (
                                    <Typography variant="caption" color="info.light">
                                      Esperando respuesta externa: {countExternalWaitingSteps(workflow)}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    Último registro: {commentElapsed ?? "sin registros"}
                                  </Typography>
                                  {!commentElapsed && (
                                    <Typography variant="caption" color="text.secondary">
                                      Último movimiento: {formatElapsedTime(getLatestWorkflowMovementAt(workflow)) ?? "sin actividad"}
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  {workflowsError ? "Detalle no disponible" : "Cargando detalle..."}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        </Button>
                      );
                    })}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
