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
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { getStepComments, getTrigger, getWorkflow, startWorkflow, updateTrigger } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail, WorkflowDetail } from "../types";
import { DEFAULT_ACTOR, formatDate, formatElapsedTime } from "../utils";

const SOLICITANTE_MAX = 150;
const TRIGGER_DESCRIPTION_MAX = 1000;

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newWorkflowFirstDescription, setNewWorkflowFirstDescription] = useState("");
  const [newWorkflowError, setNewWorkflowError] = useState<string | null>(null);
  const [newWorkflowSuccess, setNewWorkflowSuccess] = useState<string | null>(null);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [workflowLatestCommentById, setWorkflowLatestCommentById] = useState<Record<string, string | null>>({});
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [editSolicitante, setEditSolicitante] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [requirementError, setRequirementError] = useState<string | null>(null);
  const navigate = useNavigate();

  function getPrimaryDetail(currentTrigger: TriggerDetail) {
    return currentTrigger.descripcion?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequester(currentTrigger: TriggerDetail) {
    return currentTrigger.solicitante?.trim() || "Sin solicitante";
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
      setError(err instanceof Error ? err.message : "No se pudo cargar el requerimiento");
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
      setRequirementError(`Solicitante supera ${SOLICITANTE_MAX} caracteres`);
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
    } catch (err) {
      setRequirementError(err instanceof Error ? err.message : "No se pudo actualizar el requerimiento");
    } finally {
      setSavingRequirement(false);
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
      const newWorkflow = await startWorkflow(trigger.id, {
        objetivo_final: trigger.descripcion ?? "Gestionar requerimiento",
        resolucion_esperada: "Flujo completado con validacion final",
        primer_paso: {
          nombre: "Tarea inicial",
          descripcion: newWorkflowFirstDescription.trim(),
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null,
        },
      });
      setNewWorkflowSuccess("Nuevo flow asociado creado.");
      setNewWorkflowFirstDescription("");
      await loadTrigger();
      navigate(`/workflows/${newWorkflow.id}`);
    } catch (err) {
      setNewWorkflowError(err instanceof Error ? err.message : "No se pudo crear el nuevo flow");
    } finally {
      setCreatingWorkflow(false);
    }
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
        <Typography color="text.secondary">Cargando requerimiento...</Typography>
      </Stack>
    );
  }

  if (error && !trigger) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!trigger) {
    return <Alert severity="info">Requerimiento no encontrado.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/requirements">
          Requerimientos
        </Link>
        <Typography color="text.primary">Detalle</Typography>
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
            borderColor: alpha("#7ec8ff", 0.14),
            background: "linear-gradient(180deg, rgba(79, 163, 255, 0.08) 0%, rgba(9, 17, 33, 0.86) 58%, rgba(7, 13, 27, 0.95) 100%)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" color="primary.light" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                    Requerimiento
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
                        label="Solicitante"
                        value={editSolicitante}
                        onChange={(event) => setEditSolicitante(event.target.value.slice(0, SOLICITANTE_MAX))}
                        disabled={savingRequirement}
                      />
                    </Stack>
                  ) : (
                    <>
                      <Typography variant="h3">{getPrimaryDetail(trigger)}</Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Solicitante: {getSecondaryRequester(trigger)}
                      </Typography>
                    </>
                  )}
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <StatusBadge value={trigger.estado_general} />
                  {editingRequirement ? (
                    <>
                      <Button variant="text" color="inherit" onClick={handleCancelEditRequirement} disabled={savingRequirement}>
                        Cancelar
                      </Button>
                      <Button variant="contained" onClick={() => void handleSaveRequirement()} disabled={savingRequirement}>
                        {savingRequirement ? "Guardando..." : "Guardar"}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outlined" color="inherit" onClick={handleStartEditRequirement}>
                      Editar requerimiento
                    </Button>
                  )}
                </Stack>
              </Stack>
              {requirementError && <Alert severity="error">{requirementError}</Alert>}

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                <InfoItem label="ID" value={trigger.id.slice(0, 8)} />
                <InfoItem label="Registrado por" value={trigger.creado_por} />
                <InfoItem label="Creado" value={formatDate(trigger.fecha_creacion)} />
                <InfoItem label="Actualizado" value={formatDate(trigger.fecha_actualizacion)} />
                <InfoItem label="Flows abiertos" value={String(requirementStats.abiertos)} />
                <InfoItem label="Flows esperando" value={String(requirementStats.esperando)} />
                <InfoItem label="Flows finalizados" value={String(requirementStats.finalizados)} />
              </Box>

              {trigger.metadata && (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    overflow: "auto",
                    borderRadius: 3,
                    backgroundColor: "rgba(7, 11, 20, 0.75)",
                    border: "1px solid",
                    borderColor: "divider",
                    fontSize: 13,
                  }}
                >
                  {JSON.stringify(trigger.metadata, null, 2)}
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="h5">Flows asociados</Typography>
                <Typography variant="body2" color="text.secondary">
                  Crea y consulta flows vinculados a este requerimiento.
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
                  label="Tarea inicial del flow *"
                  multiline
                  minRows={3}
                  value={newWorkflowFirstDescription}
                  onChange={(event) => setNewWorkflowFirstDescription(event.target.value)}
                  disabled={creatingWorkflow}
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
                  <Typography variant="h6">Flows del requerimiento</Typography>
                  {workflowsError && <Alert severity="warning">{workflowsError}</Alert>}
                  <Stack spacing={1}>
                    {trigger.workflow_ids.map((workflowId, index) => {
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
                          borderColor: "rgba(170, 214, 255, 0.24)",
                          backgroundColor: "rgba(6, 20, 40, 0.35)",
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
                              <Typography sx={{ fontWeight: 700 }}>
                                Flow {index + 1}
                              </Typography>
                              {workflowsById[workflowId] && <StatusBadge value={getWorkflowDisplayStatus(workflowsById[workflowId])} />}
                            </Stack>
                            {workflowsById[workflowId] ? (
                              <>
                                <Typography variant="caption" color="text.secondary">
                                  Tareas: {workflowsById[workflowId].steps.length}
                                </Typography>
                                {countExternalWaitingSteps(workflowsById[workflowId]) > 0 && (
                                  <Typography variant="caption" color="info.light">
                                    Esperando respuesta externa: {countExternalWaitingSteps(workflowsById[workflowId])}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary">
                                  Ultimo registro: {commentElapsed ?? "sin registros"}
                                </Typography>
                                {!commentElapsed && (
                                  <Typography variant="caption" color="text.secondary">
                                    Ultimo movimiento: {formatElapsedTime(getLatestWorkflowMovementAt(workflowsById[workflowId])) ?? "sin actividad"}
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

type InfoItemProps = {
  label: string;
  value: string;
};

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 4,
        border: "1px solid",
        borderColor: "rgba(160, 206, 255, 0.12)",
        backgroundColor: "rgba(7, 15, 30, 0.62)",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1.1, textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.55 }}>
        {value}
      </Typography>
    </Box>
  );
}
