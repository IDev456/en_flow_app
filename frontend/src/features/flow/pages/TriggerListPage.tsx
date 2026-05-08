import { useEffect, useMemo, useState, type MouseEvent } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { HoverEntityActions } from "../../../components/HoverEntityActions";
import { cancelWorkflow, createTrigger, deleteTrigger, getWorkflow, listTriggers, listWorkflows } from "../api";
import { EmptyTriggerList } from "../components/EmptyTriggerList";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import { formatElapsedTime, getStatusTone } from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "active" | "waiting" | "closed";
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
  { value: "closed", label: "Finalizados" },
  { value: "all", label: "Todos" },
];

const flowSortOptions: Array<{ value: FlowSort; label: string }> = [
  { value: "latest_activity", label: "Último registro" },
  { value: "creation_date", label: "Fecha de creación" },
];

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
  if (tone === "finalizado" || tone === "completado" || tone === "resuelto" || tone === "cancelado") return "closed";
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
      { active: 0, waiting: 0, closed: 0 }
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
      { active: 0, waiting: 0, closed: 0 }
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

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.25}
              sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
            >
              <Box>
                <Typography variant="h3">{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                  {viewMode === "flows" ? "Trabajo abierto y seguimiento operativo" : "Agrupación y seguimiento general"}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                {viewMode === "requirements" && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setCreateRequirementOpen((value) => !value);
                      setCreateRequirementError(null);
                    }}
                  >
                    {createRequirementOpen ? "Cancelar" : "Nuevo requerimiento"}
                  </Button>
                )}

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
              </Stack>
            </Stack>

            {viewMode === "requirements" && createRequirementOpen && (
              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
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
                </CardContent>
              </Card>
            )}

            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { lg: "flex-end" } }}
            >
              <Box sx={{ width: "100%", maxWidth: { lg: 520 }, flexShrink: 0 }}>
                <TextField
                  fullWidth
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={viewMode === "flows" ? "Buscar flow o tarea..." : "Buscar requerimiento..."}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Stack spacing={1} sx={{ width: "100%", alignItems: { lg: "flex-end" } }}>
                {viewMode === "flows" && (
                  <TextField
                    select
                    size="small"
                    label="Ordenar"
                    value={flowSort}
                    onChange={(event) => setFlowSort(event.target.value as FlowSort)}
                    sx={{ minWidth: { xs: "100%", sm: 240 }, maxWidth: { lg: 280 } }}
                  >
                    {flowSortOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={stateFilter}
                  onChange={(_, value: FlowFilter | null) => {
                    if (value) setStateFilter(value);
                  }}
                  sx={{ flexWrap: "wrap", rowGap: 0.75, justifyContent: { lg: "flex-end" }, alignSelf: { lg: "flex-end" } }}
                >
                  {flowFilterOptions.map((option) => {
                    const countLabel = option.value === "all" ? "" : ` (${currentCounts[option.value] ?? 0})`;
                    return (
                      <ToggleButton key={option.value} value={option.value}>
                        {option.label}
                        {countLabel}
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>
              </Stack>
            </Stack>

            {loading && (
              <Stack direction="row" spacing={1.25} sx={{ py: 4, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando...</Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && viewMode === "flows" && (
              <Stack spacing={1.15}>
                {filteredFlows.length === 0 ? (
                  <Alert severity="info">{emptyFlowMessage}</Alert>
                ) : (
                  filteredFlows.map((item) => {
                    const step = item.relevantStep;
                    const stepLabel =
                      step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
                        ? "Tarea actual"
                        : "Última tarea";
                    const movement = formatElapsedTime(item.latestMovementAt);
                    const canShowActions = canCancelWorkflow(item.workflow);

                    return (
                      <Card
                        key={item.workflow.id}
                        variant="outlined"
                        sx={{
                          position: "relative",
                          borderRadius: 2.2,
                          "& .flow-secondary-actions": {
                            opacity: { xs: 1, sm: 0 },
                            visibility: { xs: "visible", sm: "hidden" },
                          },
                          "&:hover .flow-secondary-actions, &:focus-within .flow-secondary-actions": {
                            opacity: 1,
                            visibility: "visible",
                          },
                        }}
                      >
                        <CardContent sx={{ p: { xs: 1.1, md: 1.2 } }}>
                          <Stack spacing={0.55}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                              <StatusBadge value={item.displayStatus} />
                              {canShowActions && (
                                <IconButton
                                  className="flow-secondary-actions"
                                  size="small"
                                  aria-label="Acciones del flow"
                                  onClick={(event) => handleOpenFlowActions(event, item.workflow.id)}
                                  sx={{ mt: -0.45, mr: -0.45, transition: "opacity 160ms ease" }}
                                >
                                  <MoreHorizRoundedIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 0.8 }}
                            >
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {stepLabel}
                                </Typography>
                                <Typography variant="h6" sx={{ mt: 0.1, lineHeight: 1.2, fontWeight: 700 }}>
                                  {step?.nombre ?? "Sin tarea registrada"}
                                </Typography>
                              </Box>

                              <Button
                                variant="outlined"
                                size="small"
                                color="inherit"
                                endIcon={<LaunchRoundedIcon fontSize="small" />}
                                onClick={() => navigate(`/workflows/${item.workflow.id}`)}
                              >
                                Abrir flow
                              </Button>
                            </Stack>

                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.55 }}>
                              <NotesRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.25 }}>
                                Último registro: {getStepRecord(step)}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.55 }}>
                              <AccessTimeRoundedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                              <Typography variant="caption" color="text.secondary">
                                {movement ?? "Sin movimiento reciente"}
                              </Typography>
                            </Stack>

                            {item.linkedRequirements.length > 0 && (
                              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                                {item.linkedRequirements.slice(0, 2).map((requirement) => (
                                  <Chip
                                    key={`${item.workflow.id}-${requirement.id}`}
                                    size="small"
                                    variant="outlined"
                                    label={requirement.descripcion?.trim() || `Req ${requirement.id.slice(0, 8)}`}
                                    icon={<AssignmentOutlinedIcon sx={{ fontSize: 14 }} />}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      navigate(`/requirements/${requirement.id}`);
                                    }}
                                    sx={{ cursor: "pointer" }}
                                  />
                                ))}
                                {item.linkedRequirements.length > 2 && (
                                  <Chip size="small" variant="outlined" label={`+${item.linkedRequirements.length - 2}`} />
                                )}
                              </Stack>
                            )}
                          </Stack>
                        </CardContent>

                        <Menu
                          anchorEl={flowActionsAnchor}
                          open={flowActionsWorkflowId === item.workflow.id}
                          onClose={handleCloseFlowActions}
                        >
                          {canCancelWorkflow(item.workflow) && (
                            <MenuItem
                              onClick={(event) => void handleCancelFlowAction(event, item.workflow.id)}
                              disabled={cancellingFlowId === item.workflow.id}
                            >
                              <ListItemIcon sx={{ minWidth: 30 }}>
                                <CancelOutlinedIcon fontSize="small" />
                              </ListItemIcon>
                              {cancellingFlowId === item.workflow.id ? "Cancelando..." : "Cancelar flow"}
                            </MenuItem>
                          )}
                        </Menu>
                      </Card>
                    );
                  })
                )}
              </Stack>
            )}

            {!loading && !error && viewMode === "requirements" && (
              <Stack spacing={1.25}>
                {filteredRequirements.length === 0 ? (
                  <EmptyTriggerList
                    filtered={Boolean(query.trim()) || stateFilter !== "all"}
                    onCreateNew={() => {
                      setCreateRequirementOpen(true);
                      setCreateRequirementError(null);
                    }}
                  />
                ) : (
                  filteredRequirements.map((trigger) => {
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
                      <Card key={trigger.id} variant="outlined" className="hover-entity-parent" sx={{ position: "relative", borderRadius: 2.2 }}>
                        <HoverEntityActions
                          onDelete={
                            deletingTriggerId || trigger.workflow_ids.length > 0
                              ? undefined
                              : () => void handleDeleteTrigger(trigger)
                          }
                        />
                        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
                          <Stack spacing={1.2}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                            >
                              <Typography variant="h6">{trigger.descripcion?.trim() || "Requerimiento sin detalle"}</Typography>
                              <StatusBadge value={trigger.estado_general} />
                            </Stack>

                            <Typography variant="body2" color="text.secondary">
                              Contexto: {trigger.solicitante?.trim() || "Sin contexto"}
                            </Typography>

                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                              {linkedWorkflows.length === 0 ? (
                                <Chip size="small" variant="outlined" label="Sin flows" />
                              ) : (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={
                                    openCount > 0
                                      ? `${linkedWorkflows.length} flows · ${openCount} abiertos`
                                      : `${linkedWorkflows.length} flows`
                                  }
                                />
                              )}
                              {waitingCount > 0 && (
                                <Chip size="small" variant="outlined" label={`Esperando: ${waitingCount}`} />
                              )}
                            </Stack>

                            <Box>
                              <Button
                                variant="outlined"
                                size="small"
                                color="inherit"
                                endIcon={<LaunchRoundedIcon fontSize="small" />}
                                onClick={() => navigate(`/requirements/${trigger.id}`)}
                              >
                                Abrir requerimiento
                              </Button>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

    </Stack>
  );
}
