import { useEffect, useMemo, useState } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { alpha } from "@mui/material/styles";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { HoverEntityActions } from "../../../components/HoverEntityActions";
import { createTrigger, deleteTrigger, getWorkflow, listTriggers, listWorkflows } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import { formatElapsedTime, getStatusTone } from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "active" | "waiting" | "blocked" | "closed";

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
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "waiting", label: "Esperando" },
  { value: "blocked", label: "Pausados / problema" },
  { value: "closed", label: "Cerrados" },
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
  if (tone === "problema") return "blocked";
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

function getFlowTitle(workflow: WorkflowDetail, linkedRequirements: TriggerDetail[]) {
  if (workflow.objetivo_final?.trim()) return workflow.objetivo_final.trim();
  if (linkedRequirements[0]?.descripcion?.trim()) return linkedRequirements[0].descripcion.trim() as string;
  return `Flow ${workflow.id.slice(0, 8)}`;
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

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Requerimientos" }: TriggerListPageProps) {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [stateFilter, setStateFilter] = useState<FlowFilter>("all");
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
      })
      .sort((a, b) => {
        const left = new Date(a.latestMovementAt ?? a.workflow.fecha_inicio).getTime();
        const right = new Date(b.latestMovementAt ?? b.workflow.fecha_inicio).getTime();
        return right - left;
      });
  }, [workflowsById, requirementByWorkflowId]);

  const filteredFlows = useMemo(
    () =>
      flowCards.filter((item) => {
        if (!matchesFlowQuery(item, query)) return false;
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(item.displayStatus) === stateFilter;
      }),
    [flowCards, query, stateFilter]
  );

  const flowCounts = useMemo(() => {
    return flowCards.reduce<Record<Exclude<FlowFilter, "all">, number>>(
      (acc, item) => {
        acc[getFlowFilterFromStatus(item.displayStatus)] += 1;
        return acc;
      },
      { active: 0, waiting: 0, blocked: 0, closed: 0 }
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
      { active: 0, waiting: 0, blocked: 0, closed: 0 }
    );
  }, [triggers]);

  async function handleDeleteTrigger(trigger: TriggerDetail) {
    const detail = trigger.descripcion?.trim() || "Requerimiento sin detalle";
    if (trigger.workflow_ids.length > 0) {
      setError("No se puede eliminar este requerimiento porque tiene flows vinculados. Primero desvincula los flows o déjalo como agrupador.");
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
  const emptyRequirementMessage = stateFilter === "all" ? "Todavía no hay requerimientos." : "No hay requerimientos para este filtro.";
  const currentCounts = viewMode === "flows" ? flowCounts : requirementCounts;

  return (
    <Stack spacing={2.25}>
      <Snackbar
        open={requirementToastOpen}
        autoHideDuration={2600}
        onClose={() => setRequirementToastOpen(false)}
        message={requirementToastMessage}
      />
      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
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

            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { lg: "center" } }}>
              <TextField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={viewMode === "flows" ? "Buscar flow o tarea..." : "Buscar requerimiento..."}
                sx={{ maxWidth: 440 }}
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

              <ToggleButtonGroup
                exclusive
                size="small"
                value={stateFilter}
                onChange={(_, value: FlowFilter | null) => {
                  if (value) setStateFilter(value);
                }}
                sx={{ flexWrap: "wrap", rowGap: 0.75, justifyContent: { lg: "flex-end" } }}
              >
                {flowFilterOptions.map((option) => {
                  const countLabel = option.value === "all" ? "" : ` (${currentCounts[option.value] ?? 0})`;
                  return (
                    <ToggleButton key={option.value} value={option.value}>
                      {option.label}{countLabel}
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Stack>

            {loading && (
              <Stack direction="row" spacing={1.25} sx={{ py: 4, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando...</Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && viewMode === "flows" && (
              <Stack spacing={1.25}>
                {filteredFlows.length === 0 ? (
                  <Alert severity="info">{emptyFlowMessage}</Alert>
                ) : (
                  filteredFlows.map((item) => {
                    const step = item.relevantStep;
                    const stepLabel = step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado) ? "Tarea actual" : "Última tarea";
                    const movement = formatElapsedTime(item.latestMovementAt);
                    const flowTitle = getFlowTitle(item.workflow, item.linkedRequirements);

                    return (
                      <Card key={item.workflow.id} variant="outlined" sx={{ borderRadius: 2.2 }}>
                        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
                          <Stack spacing={1.2}>
                            <StatusBadge value={item.displayStatus} />

                            <Box>
                              <Typography variant="subtitle2" color="text.secondary">
                                {stepLabel}
                              </Typography>
                              <Typography variant="h6" sx={{ mt: 0.25 }}>
                                {step?.nombre ?? "Sin tarea registrada"}
                              </Typography>
                            </Box>

                            <Typography variant="body2" color="text.secondary">
                              Flow: {flowTitle}
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                              Último registro: {getStepRecord(step)}
                            </Typography>

                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.75 }}>
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                                <AccessTimeRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="caption" color="text.secondary">
                                  {movement ?? "Sin movimiento reciente"}
                                </Typography>
                              </Stack>

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

                            {item.linkedRequirements.length > 0 && (
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                                {item.linkedRequirements.slice(0, 2).map((requirement) => (
                                  <Chip
                                    key={`${item.workflow.id}-${requirement.id}`}
                                    size="small"
                                    variant="outlined"
                                    label={requirement.descripcion?.trim() || `Req ${requirement.id.slice(0, 8)}`}
                                  />
                                ))}
                                {item.linkedRequirements.length > 2 && (
                                  <Chip size="small" variant="outlined" label={`+${item.linkedRequirements.length - 2}`} />
                                )}
                              </Stack>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Stack>
            )}

            {!loading && !error && viewMode === "requirements" && (
              <Stack spacing={1.25}>
                {filteredRequirements.length === 0 ? (
                  <Alert severity="info">{emptyRequirementMessage}</Alert>
                ) : (
                  filteredRequirements.map((trigger) => {
                    const linkedWorkflows = trigger.workflow_ids
                      .map((workflowId) => workflowsById[workflowId])
                      .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));

                    const openCount = linkedWorkflows.filter((workflow) => {
                      const filter = getFlowFilterFromStatus(getWorkflowDisplayStatus(workflow));
                      return filter === "active" || filter === "waiting" || filter === "blocked";
                    }).length;
                    const waitingCount = linkedWorkflows.filter(
                      (workflow) => getFlowFilterFromStatus(getWorkflowDisplayStatus(workflow)) === "waiting"
                    ).length;
                    const closedCount = linkedWorkflows.filter(
                      (workflow) => getFlowFilterFromStatus(getWorkflowDisplayStatus(workflow)) === "closed"
                    ).length;

                    return (
                      <Card key={trigger.id} variant="outlined" className="hover-entity-parent" sx={{ position: "relative", borderRadius: 2.2 }}>
                        <HoverEntityActions onDelete={deletingTriggerId ? undefined : () => void handleDeleteTrigger(trigger)} />
                        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
                          <Stack spacing={1.2}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                              <Typography variant="h6">{trigger.descripcion?.trim() || "Requerimiento sin detalle"}</Typography>
                              <StatusBadge value={trigger.estado_general} />
                            </Stack>

                            <Typography variant="body2" color="text.secondary">
                              Contexto: {trigger.solicitante?.trim() || "Sin contexto"}
                            </Typography>

                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                              <Chip size="small" variant="outlined" label={`${linkedWorkflows.length} flows`} />
                              <Chip size="small" variant="outlined" label={`Abiertos: ${openCount}`} />
                              <Chip size="small" variant="outlined" label={`Esperando: ${waitingCount}`} />
                              <Chip size="small" variant="outlined" label={`Cerrados: ${closedCount}`} />
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

      {!loading && !error && viewMode === "flows" && (
        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
          {filteredFlows.length} flows en vista.
        </Typography>
      )}
    </Stack>
  );
}
