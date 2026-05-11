import { useEffect, useMemo, useState, type MouseEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";

import { HoverEntityActions } from "../../../components/HoverEntityActions";
import { PageContainer } from "../../../components/layout/PageContainer";
import { cancelWorkflow, createTrigger, deleteTrigger, deleteWorkflow, getWorkflow, listTriggers, listWorkflows } from "../api";
import { EmptyTriggerList } from "../components/EmptyTriggerList";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import { formatElapsedTime, getStatusTone } from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "active" | "waiting" | "finalized";
type FlowSort = "latest_activity" | "creation_date";

type TriggerListPageProps = {
  defaultView?: ViewMode;
  lockView?: boolean;
  title?: string;
};

type FlowCardData = {
  workflow: WorkflowDetail;
  displayStatus: string;
  relevantStep: Step | null;
  latestMovementAt: string | null;
  linkedRequirements: TriggerDetail[];
};

const flowFilterOptions: Array<{ value: FlowFilter; label: string }> = [
  { value: "active", label: "Activos" },
  { value: "waiting", label: "Esperando" },
  { value: "finalized", label: "Finalizados" },
  { value: "all", label: "Todos" },
];

const flowSortOptions: Array<{ value: FlowSort; label: string }> = [
  { value: "latest_activity", label: "Último registro" },
  { value: "creation_date", label: "Fecha de creación" },
];

function getFilterIcon(filter: FlowFilter) {
  if (filter === "active") return <BoltRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "waiting") return <HourglassTopRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "finalized") return <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />;
  return <InboxRoundedIcon sx={{ fontSize: 14 }} />;
}

function getWorkflowDisplayStatus(workflow: WorkflowDetail) {
  if (workflow.estado === "esperando_respuesta") return "esperando_respuesta";
  if (workflow.estado === "en_espera") return "en_espera";
  if (workflow.estado === "con_problema") return "con_problema";
  if (workflow.estado === "finalizado" || workflow.estado === "cancelado") return workflow.estado;

  const openSteps = workflow.steps.filter((step) => step.estado !== "completado");
  if (openSteps.some((step) => step.estado === "esperando_respuesta")) return "esperando_respuesta";
  if (openSteps.some((step) => step.estado === "problema")) return "con_problema";
  if (openSteps.some((step) => step.estado === "espera")) return "en_espera";
  if (openSteps.some((step) => step.estado === "activo")) return "en_proceso";

  return workflow.estado;
}

function getFlowFilterFromStatus(statusValue: string): Exclude<FlowFilter, "all"> {
  const tone = getStatusTone(statusValue);
  if (tone === "cancelado") return "finalized";
  if (tone === "finalizado" || tone === "completado" || tone === "resuelto") return "finalized";
  if (tone === "espera" || tone === "espera_externa" || statusValue === "en_espera") return "waiting";
  return "active";
}

function pickRelevantStep(workflow: WorkflowDetail): Step | null {
  const byOrder = [...workflow.steps].sort((a, b) => a.orden - b.orden);

  const active = byOrder.find((step) => step.estado === "activo");
  if (active) return active;

  const waitingExternal = byOrder.find((step) => step.estado === "esperando_respuesta");
  if (waitingExternal) return waitingExternal;

  const blocked = byOrder.find((step) => step.estado === "problema" || step.estado === "espera");
  if (blocked) return blocked;

  if (byOrder.length === 0) return null;

  const byRecentState = [...workflow.steps].sort(
    (a, b) => new Date(b.fecha_estado_actual).getTime() - new Date(a.fecha_estado_actual).getTime()
  );
  return byRecentState[0] ?? byOrder[0] ?? null;
}

function getLatestMovementAt(workflow: WorkflowDetail) {
  return workflow.steps.reduce<string | null>((latest, step) => {
    const candidate = step.ultimo_comentario_fecha ?? step.fecha_estado_actual;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, null);
}

function getStepRecord(step: Step | null) {
  if (!step) return "Sin registros todavía";
  return step.ultimo_comentario?.trim() || (step.descripcion?.trim() ?? "Sin registros todavía");
}

function canCancelWorkflow(workflow: WorkflowDetail) {
  return ["en_proceso", "esperando_respuesta", "en_espera", "con_problema"].includes(workflow.estado);
}

function canDeleteWorkflow(workflow: WorkflowDetail) {
  return ["cancelado", "finalizado"].includes(workflow.estado);
}

function matchesFlowQuery(data: FlowCardData, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    data.workflow.id,
    data.workflow.objetivo_final ?? "",
    data.relevantStep?.nombre ?? "",
    data.relevantStep?.descripcion ?? "",
    ...data.linkedRequirements.map((item) => item.descripcion ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function matchesRequirementQuery(trigger: TriggerDetail, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = `${trigger.id} ${trigger.descripcion ?? ""} ${trigger.solicitante ?? ""}`.toLowerCase();
  return haystack.includes(normalized);
}

function getDateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Requerimientos" }: TriggerListPageProps) {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [stateFilter, setStateFilter] = useState<FlowFilter>("all");
  const [flowSort, setFlowSort] = useState<FlowSort>("latest_activity");
  const [loading, setLoading] = useState(true);
  const [deletingTriggerId, setDeletingTriggerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createRequirementOpen, setCreateRequirementOpen] = useState(false);
  const [newRequirementDescription, setNewRequirementDescription] = useState("");
  const [newRequirementContext, setNewRequirementContext] = useState("");
  const [creatingRequirement, setCreatingRequirement] = useState(false);
  const [createRequirementError, setCreateRequirementError] = useState<string | null>(null);
  const [requirementToastOpen, setRequirementToastOpen] = useState(false);
  const [requirementToastMessage, setRequirementToastMessage] = useState<string | null>(null);
  const [flowToastOpen, setFlowToastOpen] = useState(false);
  const [flowToastMessage, setFlowToastMessage] = useState<string | null>(null);
  const [flowActionsAnchor, setFlowActionsAnchor] = useState<HTMLElement | null>(null);
  const [flowActionsWorkflowId, setFlowActionsWorkflowId] = useState<string | null>(null);
  const [cancellingFlowId, setCancellingFlowId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setViewMode(defaultView);
    setStateFilter("all");
  }, [defaultView]);

  useEffect(() => {
    const state = location.state as { openCreateRequirement?: boolean; toast?: string } | null;
    if (!state) return;

    if (state.toast) {
      setRequirementToastMessage(state.toast);
      setRequirementToastOpen(true);
    }

    if (state.openCreateRequirement && defaultView === "requirements") {
      setViewMode("requirements");
      setCreateRequirementOpen(true);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [defaultView, location.pathname, location.state, navigate]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [triggerData, workflowSummaries] = await Promise.all([listTriggers(), listWorkflows()]);
      setTriggers(triggerData);

      const workflowIds = [...new Set(workflowSummaries.map((workflow) => workflow.id))];
      const workflowDetails = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));
      setWorkflowsById(Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  const requirementByWorkflowId = useMemo(() => {
    const map: Record<string, TriggerDetail[]> = {};
    for (const trigger of triggers) {
      for (const workflowId of trigger.workflow_ids) {
        if (!map[workflowId]) {
          map[workflowId] = [];
        }
        map[workflowId].push(trigger);
      }
    }
    return map;
  }, [triggers]);

  const flowCards = useMemo<FlowCardData[]>(() => {
    return Object.values(workflowsById)
      .map((workflow) => {
        const linkedRequirements = requirementByWorkflowId[workflow.id] ?? [];
        return {
          workflow,
          displayStatus: getWorkflowDisplayStatus(workflow),
          relevantStep: pickRelevantStep(workflow),
          latestMovementAt: getLatestMovementAt(workflow),
          linkedRequirements,
        };
      });
  }, [workflowsById, requirementByWorkflowId]);

  const filteredFlows = useMemo(
    () => {
      const filtered = flowCards.filter((item) => {
        if (!matchesFlowQuery(item, query)) return false;
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(item.displayStatus) === stateFilter;
      });

      return [...filtered].sort((leftItem, rightItem) => {
        const leftCreation = getDateValue(leftItem.workflow.fecha_inicio) ?? 0;
        const rightCreation = getDateValue(rightItem.workflow.fecha_inicio) ?? 0;

        if (flowSort === "creation_date") {
          return rightCreation - leftCreation;
        }

        const leftLatest = getDateValue(leftItem.latestMovementAt);
        const rightLatest = getDateValue(rightItem.latestMovementAt);

        if (leftLatest === null && rightLatest === null) {
          return rightCreation - leftCreation;
        }
        if (leftLatest === null) return 1;
        if (rightLatest === null) return -1;
        return rightLatest - leftLatest;
      });
    },
    [flowCards, query, stateFilter, flowSort]
  );

  const flowCounts = useMemo(() => {
    return flowCards.reduce<Record<Exclude<FlowFilter, "all">, number>>(
      (acc, item) => {
        acc[getFlowFilterFromStatus(item.displayStatus)] += 1;
        return acc;
      },
      { active: 0, waiting: 0, finalized: 0 }
    );
  }, [flowCards]);

  const filteredRequirements = useMemo(
    () =>
      triggers.filter((trigger) => {
        if (!matchesRequirementQuery(trigger, query)) return false;
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(trigger.estado_general) === stateFilter;
      }),
    [triggers, query, stateFilter]
  );

  const requirementCounts = useMemo(() => {
    return triggers.reduce<Record<Exclude<FlowFilter, "all">, number>>(
      (acc, trigger) => {
        acc[getFlowFilterFromStatus(trigger.estado_general)] += 1;
        return acc;
      },
      { active: 0, waiting: 0, finalized: 0 }
    );
  }, [triggers]);

  async function handleDeleteTrigger(trigger: TriggerDetail) {
    const detail = trigger.descripcion?.trim() || "Requerimiento sin detalle";
    if (trigger.workflow_ids.length > 0) {
      setError("No se puede eliminar este requerimiento porque tiene flows vinculados. Primero desvinculá los flows que quieras conservar, o cancelá/finalizá y eliminá los flows que ya no correspondan.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar este requerimiento?\n\n${detail}\n\nEsta acción no se puede deshacer.\nSolo se eliminará si no tiene flows vinculados.`
    );
    if (!confirmed) return;

    try {
      setDeletingTriggerId(trigger.id);
      setError(null);
      await deleteTrigger(trigger.id);
      await loadData();
      setRequirementToastMessage("Requerimiento eliminado.");
      setRequirementToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el requerimiento");
    } finally {
      setDeletingTriggerId(null);
    }
  }

  async function handleCreateRequirement() {
    if (newRequirementDescription.trim().length < 3) {
      setCreateRequirementError("Debes indicar el requerimiento.");
      return;
    }

    try {
      setCreatingRequirement(true);
      setCreateRequirementError(null);
      await createTrigger({
        descripcion: newRequirementDescription.trim(),
        solicitante: newRequirementContext.trim() || null,
        tipo: "requerimiento",
        metadata: null,
      });
      setCreateRequirementOpen(false);
      setNewRequirementDescription("");
      setNewRequirementContext("");
      await loadData();
      setRequirementToastMessage("Requerimiento creado.");
      setRequirementToastOpen(true);
    } catch (err) {
      setCreateRequirementError(err instanceof Error ? err.message : "No se pudo guardar el requerimiento");
    } finally {
      setCreatingRequirement(false);
    }
  }

  const emptyFlowMessage = stateFilter === "all" ? "Todavía no hay flows." : "No hay flows para este filtro.";
  const currentCounts = viewMode === "flows" ? flowCounts : requirementCounts;

  function handleOpenFlowActions(event: MouseEvent<HTMLElement>, workflowId: string) {
    event.preventDefault();
    event.stopPropagation();
    setFlowActionsAnchor(event.currentTarget);
    setFlowActionsWorkflowId(workflowId);
  }

  function handleCloseFlowActions() {
    setFlowActionsAnchor(null);
    setFlowActionsWorkflowId(null);
  }

  async function handleCancelFlowAction(event: MouseEvent<HTMLElement>, workflowId: string) {
    event.preventDefault();
    event.stopPropagation();
    handleCloseFlowActions();

    const workflow = workflowsById[workflowId];
    if (!workflow || !canCancelWorkflow(workflow)) return;

    const confirmed = window.confirm(
      "¿Cancelar este flow?\n\nNo se eliminarán tareas, registros ni requerimientos vinculados.\nEl flow quedará fuera de la operación activa."
    );
    if (!confirmed) return;

    try {
      setCancellingFlowId(workflowId);
      setError(null);
      await cancelWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow cancelado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el flow.");
    } finally {
      setCancellingFlowId(null);
    }
  }

  async function handleDeleteFlowAction(event: MouseEvent<HTMLElement>, workflowId: string) {
    event.preventDefault();
    event.stopPropagation();
    handleCloseFlowActions();

    const workflow = workflowsById[workflowId];
    if (!workflow || !canDeleteWorkflow(workflow)) return;

    const confirmed = window.confirm(
      "¿Eliminar este flow?\n\nEsta acción eliminará el flow, sus tareas, comentarios, historial, eventos externos y vínculos con requerimientos.\n\nEsta acción no se puede deshacer."
    );
    if (!confirmed) return;

    try {
      setDeletingFlowId(workflowId);
      setError(null);
      await deleteWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow eliminado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el flow.");
    } finally {
      setDeletingFlowId(null);
    }
  }

  const selectedWorkflowForActions = flowActionsWorkflowId ? workflowsById[flowActionsWorkflowId] ?? null : null;
  const isFlowsView = viewMode === "flows";
  const pageTitle = title || (isFlowsView ? "Flows" : "Requerimientos");
  const pageSubtitle = isFlowsView
    ? "Trabajo activo, estados y continuidad operativa."
    : "Entradas, contexto y trazabilidad general.";

  function openCaptureModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("modal", "capture");
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  return (
    <Stack spacing={2.25}>
      <Snackbar
        open={requirementToastOpen}
        autoHideDuration={2600}
        onClose={() => setRequirementToastOpen(false)}
        message={requirementToastMessage}
      />
      <Snackbar
        open={flowToastOpen}
        autoHideDuration={2600}
        onClose={() => setFlowToastOpen(false)}
        message={flowToastMessage}
      />

      <PageContainer
        breadcrumbs={[{ label: pageTitle }]}
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <>
            <Tooltip title="Refrescar">
              <IconButton color="inherit" onClick={() => void loadData()} aria-label="Refrescar listado">
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {isFlowsView ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCaptureModal}>
                Capturar tarea
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setCreateRequirementOpen((value) => !value);
                  setCreateRequirementError(null);
                }}
              >
                {createRequirementOpen ? "Cerrar formulario" : "Nuevo requerimiento"}
              </Button>
            )}
          </>
        }
      >
        <Stack spacing={1.6}>
          <Paper sx={{ p: { xs: 1.25, sm: 1.5 } }}>
            <Stack spacing={1.2}>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { lg: "center" } }}>
                <Box sx={{ width: "100%", maxWidth: { lg: 560 } }}>
                  <TextField
                    size="small"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={isFlowsView ? "Buscar flow, tarea o requerimiento vinculado..." : "Buscar requerimiento..."}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon color="action" sx={{ fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>

                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.8 }}>
                  {!lockView && (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={viewMode}
                      onChange={(_, value: ViewMode | null) => {
                        if (!value) return;
                        setViewMode(value);
                        setStateFilter("all");
                        setCreateRequirementOpen(false);
                        setCreateRequirementError(null);
                      }}
                    >
                      <ToggleButton value="flows">Flows</ToggleButton>
                      <ToggleButton value="requirements">Requerimientos</ToggleButton>
                    </ToggleButtonGroup>
                  )}

                  {isFlowsView && (
                    <Box sx={{ minWidth: { xs: "100%", sm: 220 } }}>
                      <TextField
                        select
                        size="small"
                        value={flowSort}
                        onChange={(event) => setFlowSort(event.target.value as FlowSort)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SortRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      >
                        {flowSortOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  )}

                  <Tooltip title="Filtros integrados">
                    <span>
                      <IconButton size="small" aria-label="Filtros" disabled>
                        <TuneRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Columnas (próximamente)">
                    <span>
                      <IconButton size="small" aria-label="Columnas" disabled>
                        <ViewColumnRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Descargar (próximamente)">
                    <span>
                      <IconButton size="small" aria-label="Descargar" disabled>
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
                <FilterListRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  Estado
                </Typography>
              </Stack>

              <ToggleButtonGroup
                exclusive
                size="small"
                value={stateFilter}
                onChange={(_, value: FlowFilter | null) => {
                  if (value) setStateFilter(value);
                }}
                sx={{
                  flexWrap: "wrap",
                  rowGap: 0.8,
                  justifyContent: { xs: "flex-start", lg: "flex-end" },
                  alignSelf: { xs: "stretch", lg: "flex-end" },
                }}
              >
                {flowFilterOptions.map((option) => {
                  const countLabel = option.value === "all" ? "" : ` (${currentCounts[option.value] ?? 0})`;
                  return (
                    <ToggleButton key={option.value} value={option.value}>
                      <Stack direction="row" spacing={0.55} sx={{ alignItems: "center" }}>
                        {getFilterIcon(option.value)}
                        <Box component="span">
                          {option.label}
                          {countLabel}
                        </Box>
                      </Stack>
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Stack>
          </Paper>

          {!isFlowsView && createRequirementOpen && (
            <Paper sx={{ p: { xs: 1.5, md: 1.8 } }}>
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" color="text.secondary">
                  Crear requerimiento
                </Typography>
                <TextField
                  label="Requerimiento"
                  multiline
                  minRows={2}
                  value={newRequirementDescription}
                  onChange={(event) => setNewRequirementDescription(event.target.value)}
                  disabled={creatingRequirement}
                />
                <TextField
                  label="Contexto"
                  value={newRequirementContext}
                  onChange={(event) => setNewRequirementContext(event.target.value)}
                  disabled={creatingRequirement}
                />
                {createRequirementError && <Alert severity="error">{createRequirementError}</Alert>}
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => void handleCreateRequirement()} disabled={creatingRequirement}>
                    {creatingRequirement ? "Creando..." : "Guardar requerimiento"}
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => {
                      setCreateRequirementOpen(false);
                      setCreateRequirementError(null);
                      setNewRequirementDescription("");
                      setNewRequirementContext("");
                    }}
                    disabled={creatingRequirement}
                  >
                    Cancelar
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {loading && (
            <Stack direction="row" spacing={1.25} sx={{ py: 4, alignItems: "center", justifyContent: "center" }}>
              <CircularProgress size={22} />
              <Typography color="text.secondary">Cargando...</Typography>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && isFlowsView && (
            <>
              {filteredFlows.length === 0 ? (
                <Alert severity="info">{emptyFlowMessage}</Alert>
              ) : (
                <Paper sx={{ overflow: "hidden" }}>
                  <Box
                    sx={{
                      px: 1.6,
                      py: 1,
                      display: { xs: "none", md: "grid" },
                      gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.35fr) minmax(0, 1fr) auto",
                      gap: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Flow / Tarea</Typography>
                    <Typography variant="caption" color="text.secondary">Último registro</Typography>
                    <Typography variant="caption" color="text.secondary">Movimiento</Typography>
                    <Typography variant="caption" color="text.secondary">Acciones</Typography>
                  </Box>

                  {filteredFlows.map((item, index) => {
                    const step = item.relevantStep;
                    const stepLabel =
                      step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
                        ? "Tarea actual"
                        : "Última tarea";
                    const movement = formatElapsedTime(item.latestMovementAt);
                    const canShowActions = canCancelWorkflow(item.workflow) || canDeleteWorkflow(item.workflow);

                    return (
                      <Box
                        key={item.workflow.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/workflows/${item.workflow.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/workflows/${item.workflow.id}`);
                          }
                        }}
                        sx={{
                          px: 1.6,
                          py: 1.2,
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1.35fr) minmax(0, 1fr) auto" },
                          gap: 1.1,
                          cursor: "pointer",
                          transition: "background-color 120ms ease",
                          borderBottom: index < filteredFlows.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          "&:hover": { bgcolor: (theme) => alpha(theme.palette.action.hover, 0.45) },
                        }}
                      >
                        <Stack spacing={0.55} sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.65} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.4 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "inline-flex", alignItems: "center", gap: 0.35 }}
                            >
                              <AssignmentOutlinedIcon sx={{ fontSize: 13 }} />
                              {item.workflow.id.slice(0, 8)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stepLabel}
                            </Typography>
                            <StatusBadge value={item.displayStatus} />
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {step?.nombre ?? "Sin tarea registrada"}
                          </Typography>
                        </Stack>

                        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { md: "none" } }}>
                            Último registro
                          </Typography>
                          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", minWidth: 0 }}>
                            <NotesRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {getStepRecord(step)}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { md: "none" } }}>
                            Movimiento
                          </Typography>
                          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", minWidth: 0 }}>
                            <AccessTimeRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">
                              {movement ?? "Sin movimiento reciente"}
                            </Typography>
                          </Stack>
                          {item.linkedRequirements.length > 0 && (
                            <Stack direction="row" spacing={0.4} sx={{ flexWrap: "wrap", gap: 0.4 }}>
                              {item.linkedRequirements.slice(0, 1).map((requirement) => (
                                <Chip
                                  key={`${item.workflow.id}-${requirement.id}`}
                                  size="small"
                                  variant="outlined"
                                  label={requirement.descripcion?.trim() || `Req ${requirement.id.slice(0, 8)}`}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    navigate(`/requirements/${requirement.id}`);
                                  }}
                                  sx={{ maxWidth: 220 }}
                                />
                              ))}
                              {item.linkedRequirements.length > 1 && (
                                <Chip size="small" variant="outlined" label={`+${item.linkedRequirements.length - 1}`} />
                              )}
                            </Stack>
                          )}
                        </Stack>

                        <Stack direction="row" spacing={0.65} sx={{ alignItems: "center", justifyContent: { md: "flex-end" } }}>
                          <Button
                            variant="outlined"
                            size="small"
                            color="inherit"
                            endIcon={<LaunchRoundedIcon fontSize="small" />}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate(`/workflows/${item.workflow.id}`);
                            }}
                          >
                            Abrir
                          </Button>
                          {canShowActions && (
                            <IconButton
                              size="small"
                              aria-label="Acciones del flow"
                              onClick={(event) => handleOpenFlowActions(event, item.workflow.id)}
                            >
                              <MoreHorizRoundedIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Paper>
              )}
            </>
          )}

          {!loading && !error && !isFlowsView && (
            <>
              {filteredRequirements.length === 0 ? (
                <EmptyTriggerList
                  filtered={Boolean(query.trim()) || stateFilter !== "all"}
                  onCreateNew={() => {
                    setCreateRequirementOpen(true);
                    setCreateRequirementError(null);
                  }}
                />
              ) : (
                <Paper sx={{ overflow: "hidden" }}>
                  <Box
                    sx={{
                      px: 1.6,
                      py: 1,
                      display: { xs: "none", md: "grid" },
                      gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr) auto",
                      gap: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">Requerimiento</Typography>
                    <Typography variant="caption" color="text.secondary">Estado y flows</Typography>
                    <Typography variant="caption" color="text.secondary">Acciones</Typography>
                  </Box>

                  {filteredRequirements.map((trigger, index) => {
                    const linkedWorkflows = trigger.workflow_ids
                      .map((workflowId) => workflowsById[workflowId])
                      .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));

                    const openCount = linkedWorkflows.filter((workflow) => {
                      const filter = getFlowFilterFromStatus(getWorkflowDisplayStatus(workflow));
                      return filter === "active" || filter === "waiting";
                    }).length;
                    const waitingCount = linkedWorkflows.filter(
                      (workflow) => getFlowFilterFromStatus(getWorkflowDisplayStatus(workflow)) === "waiting"
                    ).length;

                    return (
                      <Box
                        key={trigger.id}
                        className="hover-entity-parent"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/requirements/${trigger.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/requirements/${trigger.id}`);
                          }
                        }}
                        sx={{
                          position: "relative",
                          px: 1.6,
                          py: 1.2,
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(0, 1.2fr) auto" },
                          gap: 1,
                          cursor: "pointer",
                          borderBottom: index < filteredRequirements.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          "&:hover": { bgcolor: (theme) => alpha(theme.palette.action.hover, 0.45) },
                        }}
                      >
                        <HoverEntityActions
                          onDelete={
                            deletingTriggerId || trigger.workflow_ids.length > 0
                              ? undefined
                              : () => void handleDeleteTrigger(trigger)
                          }
                        />

                        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {trigger.descripcion?.trim() || "Requerimiento sin detalle"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            Contexto: {trigger.solicitante?.trim() || "Sin contexto"}
                          </Typography>
                        </Stack>

                        <Stack spacing={0.55}>
                          <StatusBadge value={trigger.estado_general} />
                          <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", gap: 0.6 }}>
                            {linkedWorkflows.length === 0 ? (
                              <Chip size="small" variant="outlined" label="Sin flows" />
                            ) : (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={openCount > 0 ? `${linkedWorkflows.length} flows · ${openCount} abiertos` : `${linkedWorkflows.length} flows`}
                              />
                            )}
                            {waitingCount > 0 && <Chip size="small" variant="outlined" label={`Esperando: ${waitingCount}`} />}
                          </Stack>
                        </Stack>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: { md: "flex-end" } }}>
                          <Button
                            variant="outlined"
                            size="small"
                            color="inherit"
                            endIcon={<LaunchRoundedIcon fontSize="small" />}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate(`/requirements/${trigger.id}`);
                            }}
                          >
                            Abrir
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Paper>
              )}
            </>
          )}
        </Stack>
      </PageContainer>

      <Menu anchorEl={flowActionsAnchor} open={Boolean(flowActionsAnchor)} onClose={handleCloseFlowActions}>
        {selectedWorkflowForActions && canCancelWorkflow(selectedWorkflowForActions) && (
          <MenuItem
            onClick={(event) => void handleCancelFlowAction(event, selectedWorkflowForActions.id)}
            disabled={cancellingFlowId === selectedWorkflowForActions.id}
          >
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CancelOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {cancellingFlowId === selectedWorkflowForActions.id ? "Cancelando..." : "Cancelar flow"}
          </MenuItem>
        )}
        {selectedWorkflowForActions && canDeleteWorkflow(selectedWorkflowForActions) && (
          <MenuItem
            onClick={(event) => void handleDeleteFlowAction(event, selectedWorkflowForActions.id)}
            disabled={deletingFlowId === selectedWorkflowForActions.id}
          >
            <ListItemIcon sx={{ minWidth: 30 }}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            {deletingFlowId === selectedWorkflowForActions.id ? "Eliminando..." : "Eliminar flow"}
          </MenuItem>
        )}
      </Menu>
    </Stack>
  );
}
