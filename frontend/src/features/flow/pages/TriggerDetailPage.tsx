import { useEffect, useMemo, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slide,
  Snackbar,
  Stack,
  TextField,
  Typography,
  type SlideProps,
} from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { deleteTrigger, getTrigger, getWorkflow, updateTrigger } from "../api";
import {
  getNavigationLocationState,
  mergeNavigationState,
  navigateBackWithOrigin,
  navigateWithOrigin,
} from "../navigation";
import { AmbitoChip } from "../components/AmbitoChip";
import { FlowTableSection } from "../components/FlowTableSection";
import { StatusBadge } from "../components/StatusBadge";
import type { Ambito, TriggerDetail, WorkflowDetail } from "../types";
import { type FlowFilter, getFlowCounts } from "../utils/flowTable";
import { getAmbitoLabel, getVisibleTriggerStatus, getVisibleWorkflowStatus } from "../utils";

const SOLICITANTE_MAX = 150;
const TRIGGER_DESCRIPTION_MAX = 1000;
type TriggerDetailRestoreState = {
  projectFlowFilter: FlowFilter;
};

function SlideUp(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = getNavigationLocationState<TriggerDetailRestoreState>(location.state);
  const restoreState = navigationState.restore;
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [deletingRequirement, setDeletingRequirement] = useState(false);
  const [editSolicitante, setEditSolicitante] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editAmbito, setEditAmbito] = useState<Ambito>(null);
  const [requirementError, setRequirementError] = useState<string | null>(null);
  const [requirementToastOpen, setRequirementToastOpen] = useState(false);
  const [ambitoConfirmOpen, setAmbitoConfirmOpen] = useState(false);
  const [projectFlowFilter, setProjectFlowFilter] = useState<FlowFilter>(() => restoreState?.projectFlowFilter ?? "operational");

  function getPrimaryDetail(currentTrigger: TriggerDetail) {
    return currentTrigger.descripcion?.trim() || "Proyecto sin detalle";
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
    setEditAmbito(trigger.ambito);
  }, [trigger?.id, trigger?.solicitante, trigger?.descripcion, trigger?.ambito]);

  useEffect(() => {
    if (restoreState?.projectFlowFilter === projectFlowFilter) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: mergeNavigationState(location.state, {
        restore: {
          projectFlowFilter,
        } satisfies TriggerDetailRestoreState,
      }),
    });
  }, [location.pathname, location.search, location.state, navigate, projectFlowFilter, restoreState]);

  async function loadTrigger() {
    try {
      setLoading(true);
      setError(null);
      setWorkflowsError(null);
      const triggerData = await getTrigger(triggerId);
      setTrigger(triggerData);

      if (triggerData.workflow_ids.length === 0) {
        setWorkflowsById({});
        return;
      }

      try {
        const workflowDetails = await Promise.all(triggerData.workflow_ids.map((workflowId) => getWorkflow(workflowId)));
        setWorkflowsById(Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])));
      } catch {
        setWorkflowsById({});
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
    setEditAmbito(trigger.ambito);
    setRequirementError(null);
    setEditingRequirement(true);
  }

  function handleCancelEditRequirement() {
    if (!trigger) return;
    setEditSolicitante(trigger.solicitante ?? "");
    setEditDescripcion(trigger.descripcion ?? "");
    setEditAmbito(trigger.ambito);
    setRequirementError(null);
    setEditingRequirement(false);
  }

  async function performSaveRequirement(propagateAmbito: boolean) {
    if (!trigger) return;

    if (editSolicitante.trim().length > SOLICITANTE_MAX) {
      setRequirementError(`Solicitante supera ${SOLICITANTE_MAX} caracteres`);
      return;
    }
    if (editDescripcion.trim().length > TRIGGER_DESCRIPTION_MAX) {
      setRequirementError(`Descripción supera ${TRIGGER_DESCRIPTION_MAX} caracteres`);
      return;
    }

    try {
      setSavingRequirement(true);
      setRequirementError(null);
      const updatedTrigger = await updateTrigger(trigger.id, {
        solicitante: editSolicitante.trim() || null,
        descripcion: editDescripcion.trim() || null,
        ambito: editAmbito,
        propagate_ambito: propagateAmbito,
      });
      setTrigger(updatedTrigger);
      setEditingRequirement(false);
      setAmbitoConfirmOpen(false);
      setRequirementToastOpen(true);
    } catch (err) {
      setRequirementError(err instanceof Error ? err.message : "No se pudo actualizar el proyecto");
    } finally {
      setSavingRequirement(false);
    }
  }

  async function handleSaveRequirement() {
    if (!trigger) return;
    if (editAmbito !== trigger.ambito) {
      setAmbitoConfirmOpen(true);
      return;
    }
    await performSaveRequirement(false);
  }

  async function handleDeleteRequirement() {
    if (!trigger) return;

    if (trigger.workflow_ids.length > 0) {
      setRequirementError(
        "No se puede eliminar este proyecto porque tiene flows vinculados. Primero desvinculá los flows o dejalo como agrupador."
      );
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

  function openLinkedCaptureModal() {
    if (!trigger) return;
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("modal", "capture");
    nextParams.set("requirementId", trigger.id);
    nextParams.set("requirementLabel", getPrimaryDetail(trigger));
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  const linkedWorkflows = (trigger?.workflow_ids ?? [])
    .map((workflowId) => workflowsById[workflowId])
    .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));
  const linkedFlowItems = useMemo(
    () => linkedWorkflows.map((workflow) => ({ workflow, displayStatus: getVisibleWorkflowStatus(workflow) })),
    [linkedWorkflows]
  );
  const canDeleteRequirement = (trigger?.workflow_ids.length ?? 0) === 0;
  const requirementStats = {
    abiertos: linkedWorkflows.filter((workflow) => getVisibleWorkflowStatus(workflow) === "en_proceso").length,
    esperando: linkedWorkflows.filter((workflow) => getVisibleWorkflowStatus(workflow) === "esperando_respuesta").length,
    finalizados: linkedWorkflows.filter((workflow) => ["finalizado", "cancelado"].includes(workflow.estado)).length,
  };
  const projectFlowCounts = useMemo(() => getFlowCounts(linkedFlowItems), [linkedFlowItems]);

  function handleProjectWorkflowDatePatched(workflowId: string, stepId: string, nextIsoValue: string | null) {
    setWorkflowsById((previous) => {
      const workflow = previous[workflowId];
      if (!workflow) {
        return previous;
      }

      return {
        ...previous,
        [workflowId]: {
          ...workflow,
          steps: workflow.steps.map((step) => (step.id === stepId ? { ...step, fecha_vencimiento: nextIsoValue } : step)),
        },
      };
    });
  }

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
    <Stack spacing={3}>
      <Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigateBackWithOrigin(navigate, location.state, "/requirements")}
        >
          Volver
        </Button>
      </Box>

      <Breadcrumbs
        separator=">"
        aria-label="breadcrumb"
        sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.75, color: "text.disabled" } }}
      >
        <Typography color="text.secondary" variant="caption">
          Proyectos
        </Typography>
        <Typography color="text.primary" variant="caption">
          Detalle
        </Typography>
      </Breadcrumbs>

      <Stack spacing={2}>
        <Snackbar
          open={requirementToastOpen}
          autoHideDuration={2600}
          onClose={() => setRequirementToastOpen(false)}
          message="Proyecto actualizado."
          slots={{ transition: SlideUp }}
        />

        <Dialog open={ambitoConfirmOpen} onClose={savingRequirement ? undefined : () => setAmbitoConfirmOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Cambiar ámbito del proyecto</DialogTitle>
          <DialogContent dividers>¿Querés aplicar este cambio también a los flows y tareas asociados?</DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setAmbitoConfirmOpen(false)} disabled={savingRequirement}>
              Cancelar
            </Button>
            <Button onClick={() => void performSaveRequirement(false)} disabled={savingRequirement}>
              Solo proyecto
            </Button>
            <Button variant="contained" onClick={() => void performSaveRequirement(true)} disabled={savingRequirement}>
              Aplicar a flows y tareas
            </Button>
          </DialogActions>
        </Dialog>

        <Card
          sx={{
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
            background: (theme) =>
              theme.palette.mode === "dark"
                ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 52%, ${alpha(theme.palette.background.default, 0.99)} 100%)`
                : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 48%, ${alpha(theme.palette.background.default, 1)} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.25}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(300px, 0.9fr)" },
                  alignItems: "start",
                }}
              >
                <Stack spacing={1.75} sx={{ minWidth: 0 }}>
                  <Stack spacing={0.9}>
                    <Typography variant="subtitle2" color="primary.light" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                      Proyecto
                    </Typography>
                    {editingRequirement ? (
                      <Stack spacing={1.25}>
                        <TextField
                          label="Descripción"
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
                        <TextField
                          select
                          label="Ámbito"
                          value={editAmbito ?? ""}
                          onChange={(event) => setEditAmbito((event.target.value || null) as Ambito)}
                          disabled={savingRequirement}
                        >
                          <MenuItem value="laboral">{getAmbitoLabel("laboral")}</MenuItem>
                          <MenuItem value="personal">{getAmbitoLabel("personal")}</MenuItem>
                          <MenuItem value="">Sin definir</MenuItem>
                        </TextField>
                      </Stack>
                    ) : (
                      <>
                        <Typography variant="h4" sx={{ lineHeight: 1.08, maxWidth: 920 }}>
                          {getPrimaryDetail(trigger)}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          Solicitante: {getSecondaryRequester(trigger)}
                        </Typography>
                      </>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    <AmbitoChip ambito={editingRequirement ? editAmbito : trigger.ambito} />
                    <StatusBadge value={getVisibleTriggerStatus(trigger.estado_general)} />
                  </Stack>

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

                  {requirementError && <Alert severity="error">{requirementError}</Alert>}
                  {trigger.workflow_activo_id ? (
                    <Alert severity="info" sx={{ alignSelf: "flex-start" }}>
                      Hay al menos un flow activo asociado a este proyecto.
                    </Alert>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No hay flow activo en este momento.
                    </Typography>
                  )}
                </Stack>

                <Stack
                  spacing={1.5}
                  sx={{
                    p: { xs: 1.4, md: 1.7 },
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.4 : 0.78),
                    boxShadow: "none",
                  }}
                >
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em", fontWeight: 700 }}>
                    Configuración
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
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

                  {!editingRequirement && !canDeleteRequirement ? (
                    <Typography variant="caption" color="text.secondary">
                      No se puede eliminar mientras tenga flows vinculados.
                    </Typography>
                  ) : null}

                  <Box
                    sx={{
                      pt: 0.5,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Captura vinculada
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, mb: 1.2 }}>
                      Usá la misma captura rápida para crear una tarea ya vinculada a este proyecto.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<PlayCircleOutlineRoundedIcon />}
                      onClick={openLinkedCaptureModal}
                      disabled={trigger.ambito === null}
                      fullWidth
                    >
                      Capturar tarea para este proyecto
                    </Button>
                    {trigger.ambito === null ? (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.85, display: "block" }}>
                        Definí el ámbito del proyecto antes de crear un flow vinculado.
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {workflowsError && <Alert severity="warning">{workflowsError}</Alert>}

        <Card sx={{ overflow: "hidden" }}>
          <CardContent sx={{ p: 0 }}>
            <FlowTableSection
              items={linkedFlowItems}
              stateFilter={projectFlowFilter}
              onStateFilterChange={setProjectFlowFilter}
              currentCounts={projectFlowCounts}
              showStateTabs
              stateTabsVariant="summary"
              showProjectColumn={false}
              allowedQuickFilters={["today", "this_week", "past", "future", "without_reminder"]}
              quickFilterPlaceholder="Buscar flow o tarea del proyecto..."
              noRowsTitle="No hay flows para este filtro"
              noRowsDescription="Probá con otro estado o capturá una nueva tarea para este proyecto."
              noSearchTitle="No hay resultados para esta búsqueda"
              noSearchDescription="Probá con otros términos para encontrar un flow o tarea de este proyecto."
              onRowNavigate={(workflowId) => navigateWithOrigin(navigate, location, `/workflows/${workflowId}`, "/requirements")}
              onWorkflowStepDatePatched={handleProjectWorkflowDatePatched}
            />
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
