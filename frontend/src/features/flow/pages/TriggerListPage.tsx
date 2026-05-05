import { useEffect, useMemo, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { HoverEntityActions } from "../../../components/HoverEntityActions";
import { deleteTrigger, getWorkflow, listTriggers } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail, WorkflowDetail } from "../types";
import { formatDate, getStatusTone } from "../utils";

type ViewMode = "requirements" | "flows";
type WorkflowStateFilter = "all" | "in_progress" | "waiting" | "done";
type TriggerListPageProps = {
  defaultView?: ViewMode;
  lockView?: boolean;
  title?: string;
};

type TriggerWorkflowRow = {
  rowId: string;
  trigger: TriggerDetail;
  workflowId: string;
  workflow: WorkflowDetail;
};

function getStateBucketFromStatus(statusValue: string): Exclude<WorkflowStateFilter, "all"> {
  const tone = getStatusTone(statusValue);
  if (tone === "finalizado" || tone === "resuelto" || tone === "completado" || tone === "cancelado") {
    return "done";
  }
  if (tone === "espera" || tone === "espera_externa" || tone === "problema" || tone === "sin_flows") {
    return "waiting";
  }
  return "in_progress";
}

function getFilterSx(filter: WorkflowStateFilter) {
  if (filter === "in_progress") {
    return {
      borderColor: "info.main",
      "&.Mui-selected": (theme: Theme) => ({ color: theme.palette.info.dark, bgcolor: alpha(theme.palette.info.main, 0.26) }),
    };
  }
  if (filter === "waiting") {
    return {
      borderColor: "warning.main",
      "&.Mui-selected": (theme: Theme) => ({ color: theme.palette.warning.dark, bgcolor: alpha(theme.palette.warning.main, 0.24) }),
    };
  }
  if (filter === "done") {
    return {
      borderColor: "success.main",
      "&.Mui-selected": (theme: Theme) => ({ color: theme.palette.success.dark, bgcolor: alpha(theme.palette.success.main, 0.22) }),
    };
  }
  return {};
}

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Requerimientos" }: TriggerListPageProps) {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [stateFilter, setStateFilter] = useState<WorkflowStateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deletingTriggerId, setDeletingTriggerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setViewMode(defaultView);
  }, [defaultView]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const triggerData = await listTriggers();
      setTriggers(triggerData);

      const workflowIds = [...new Set(triggerData.flatMap((trigger) => trigger.workflow_ids))];
      const details = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));
      setWorkflowsById(Object.fromEntries(details.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  function getPrimaryDetail(trigger: TriggerDetail) {
    return trigger.descripcion?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequester(trigger: TriggerDetail) {
    return trigger.solicitante?.trim() || "Sin contexto";
  }

  function getWorkflowDisplayStatus(workflow: WorkflowDetail, trigger: TriggerDetail) {
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
    if (workflow.estado === "en_proceso") {
      const openSteps = workflow.steps.filter((step) => step.estado !== "completado");
      if (openSteps.some((step) => step.estado === "esperando_respuesta")) {
        return "esperando_respuesta";
      }
      if (openSteps.some((step) => step.estado === "espera" || step.estado === "problema")) {
        return "espera";
      }
    }
    return workflow.estado || trigger.estado_general;
  }

  const flowRows = useMemo<TriggerWorkflowRow[]>(() => {
    return triggers.flatMap((trigger) =>
      trigger.workflow_ids
        .map((workflowId) => {
          const workflow = workflowsById[workflowId];
          if (!workflow) return null;
          return {
            rowId: `${trigger.id}:${workflowId}`,
            trigger,
            workflowId,
            workflow,
          };
        })
        .filter((row): row is TriggerWorkflowRow => row !== null)
    );
  }, [triggers, workflowsById]);

  const workflowStatusById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of flowRows) {
      map[row.workflowId] = getWorkflowDisplayStatus(row.workflow, row.trigger);
    }
    return map;
  }, [flowRows]);

  function getRequirementBucket(trigger: TriggerDetail): Exclude<WorkflowStateFilter, "all"> {
    const workflowStates = trigger.workflow_ids
      .map((workflowId) => workflowStatusById[workflowId])
      .filter((value): value is string => Boolean(value))
      .map((value) => getStateBucketFromStatus(value));

    if (workflowStates.length === 0) {
      return "waiting";
    }
    if (workflowStates.every((bucket) => bucket === "done")) {
      return "done";
    }
    if (workflowStates.some((bucket) => bucket === "in_progress")) {
      return "in_progress";
    }
    return "waiting";
  }

  function matchesQuery(trigger: TriggerDetail) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const haystack = `${trigger.id} ${trigger.solicitante ?? ""} ${trigger.descripcion ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  }

  function filterByState(bucket: Exclude<WorkflowStateFilter, "all">) {
    return stateFilter === "all" || stateFilter === bucket;
  }

  const requirementCounts = useMemo(() => {
    return triggers.reduce<Record<Exclude<WorkflowStateFilter, "all">, number>>(
      (acc, trigger) => {
        acc[getRequirementBucket(trigger)] += 1;
        return acc;
      },
      { in_progress: 0, waiting: 0, done: 0 }
    );
  }, [triggers, workflowStatusById]);

  const flowCounts = useMemo(() => {
    return flowRows.reduce<Record<Exclude<WorkflowStateFilter, "all">, number>>(
      (acc, row) => {
        acc[getStateBucketFromStatus(getWorkflowDisplayStatus(row.workflow, row.trigger))] += 1;
        return acc;
      },
      { in_progress: 0, waiting: 0, done: 0 }
    );
  }, [flowRows]);

  const filteredRequirementRows = useMemo(
    () =>
      triggers.filter((trigger) => {
        if (!matchesQuery(trigger)) return false;
        return filterByState(getRequirementBucket(trigger));
      }),
    [triggers, query, stateFilter, workflowStatusById]
  );

  const filteredFlowRows = useMemo(
    () =>
      flowRows.filter((row) => {
        if (!matchesQuery(row.trigger)) return false;
        return filterByState(getStateBucketFromStatus(getWorkflowDisplayStatus(row.workflow, row.trigger)));
      }),
    [flowRows, query, stateFilter]
  );

  async function handleDeleteTrigger(trigger: TriggerDetail) {
    const detail = getPrimaryDetail(trigger);
    const confirmed = window.confirm(`Eliminar requerimiento?\n\n${detail}`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingTriggerId(trigger.id);
      setError(null);
      await deleteTrigger(trigger.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el requerimiento");
    } finally {
      setDeletingTriggerId(null);
    }
  }

  const activeFlows = flowCounts.in_progress + flowCounts.waiting;
  const totalCreatedSteps = flowRows.reduce((sum, row) => sum + row.workflow.steps.length, 0);

  const currentRowsCount = viewMode === "requirements" ? filteredRequirementRows.length : filteredFlowRows.length;
  const currentCounts = viewMode === "requirements" ? requirementCounts : flowCounts;

  return (
    <Stack spacing={2.25}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", lg: "center" } }}
            >
              <Box>
                <Typography variant="h2">{title}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", gap: 1 }}>
                  <Chip size="small" label={`Requerimientos: ${triggers.length}`} variant="outlined" />
                  <Chip size="small" label={`Flows activos: ${activeFlows}`} variant="outlined" />
                  <Chip size="small" label={`Flows completados: ${flowCounts.done}`} variant="outlined" />
                  <Chip size="small" label={`Tareas: ${totalCreatedSteps}`} variant="outlined" />
                </Stack>
              </Box>
              {!lockView && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={viewMode}
                  onChange={(_, value: ViewMode | null) => {
                    if (value) setViewMode(value);
                  }}
                >
                  <ToggleButton value="requirements">Vista requerimientos</ToggleButton>
                  <ToggleButton value="flows">Vista flows</ToggleButton>
                </ToggleButtonGroup>
              )}
            </Stack>

            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <TextField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  viewMode === "flows"
                    ? "Buscar por flow, contexto o id..."
                    : "Buscar por requerimiento, contexto o id..."
                }
                sx={{ maxWidth: 460 }}
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
                onChange={(_, value: WorkflowStateFilter | null) => {
                  if (value) {
                    setStateFilter(value);
                  }
                }}
                sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", lg: "flex-end" }, rowGap: 0.75 }}
              >
                <ToggleButton value="all" sx={getFilterSx("all")}>
                  Todos
                </ToggleButton>
                <ToggleButton value="in_progress" sx={getFilterSx("in_progress")}>
                  En proceso ({currentCounts.in_progress})
                </ToggleButton>
                <ToggleButton value="waiting" sx={getFilterSx("waiting")}>
                  En espera ({currentCounts.waiting})
                </ToggleButton>
                <ToggleButton value="done" sx={getFilterSx("done")}>
                  Completados ({currentCounts.done})
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {!loading && !error && (
              <Typography variant="body2" color="text.secondary">
                {currentRowsCount} {viewMode === "requirements" ? "requerimientos" : "flows"} en vista.
              </Typography>
            )}

            {loading && (
              <Stack direction="row" spacing={1.5} sx={{ py: 6, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando {viewMode === "requirements" ? "requerimientos" : "flows"}...</Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && currentRowsCount === 0 && (
              <Alert severity="info">No hay elementos para el filtro actual.</Alert>
            )}

            {!loading && !error && currentRowsCount > 0 && (
              <>
                {viewMode === "requirements" ? (
                  <>
                    <TableContainer
                      component={Paper}
                      sx={{
                        display: { xs: "none", md: "block" },
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.78),
                        overflow: "hidden",
                      }}
                    >
                      <Table sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "56%" }}>Detalle</TableCell>
                            <TableCell sx={{ width: "22%" }}>Contexto</TableCell>
                            <TableCell sx={{ width: "10%" }}>Flows</TableCell>
                            <TableCell sx={{ width: "12%" }}>Tareas totales</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredRequirementRows.map((trigger) => {
                            const workflows = trigger.workflow_ids
                              .map((workflowId) => workflowsById[workflowId])
                              .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));
                            const stepCount = workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0);
                            return (
                              <TableRow
                                key={trigger.id}
                                hover
                                onClick={() => navigate(`/requirements/${trigger.id}`)}
                                className="hover-entity-parent"
                                sx={{ cursor: "pointer" }}
                              >
                                <TableCell>
                                  <Box sx={{ position: "relative", pr: 11 }}>
                                    <HoverEntityActions
                                      onDelete={deletingTriggerId ? undefined : () => void handleDeleteTrigger(trigger)}
                                      sx={{ top: -2, right: 0 }}
                                    />
                                    <Typography sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                                      {getPrimaryDetail(trigger)}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>{getSecondaryRequester(trigger)}</TableCell>
                                <TableCell>{trigger.workflow_ids.length}</TableCell>
                                <TableCell>{stepCount === 1 ? "1 tarea" : `${stepCount} tareas`}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
                      {filteredRequirementRows.map((trigger) => {
                        const workflows = trigger.workflow_ids
                          .map((workflowId) => workflowsById[workflowId])
                          .filter((workflow): workflow is WorkflowDetail => Boolean(workflow));
                        const stepCount = workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0);
                        return (
                          <Card
                            key={trigger.id}
                            className="hover-entity-parent"
                            sx={{ position: "relative", cursor: "pointer" }}
                            onClick={() => navigate(`/requirements/${trigger.id}`)}
                          >
                            <HoverEntityActions
                              onDelete={deletingTriggerId ? undefined : () => void handleDeleteTrigger(trigger)}
                            />
                            <CardContent>
                              <Stack spacing={1.25}>
                                <Typography variant="h6">{getPrimaryDetail(trigger)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {getSecondaryRequester(trigger)}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                                  <Chip label={`${trigger.workflow_ids.length} flows`} size="small" variant="outlined" />
                                  <Chip label={stepCount === 1 ? "1 tarea" : `${stepCount} tareas`} size="small" variant="outlined" />
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </>
                ) : (
                  <>
                    <TableContainer
                      component={Paper}
                      sx={{
                        display: { xs: "none", md: "block" },
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: "divider",
                        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.78),
                        overflow: "hidden",
                      }}
                    >
                      <Table sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "40%" }}>Flow</TableCell>
                            <TableCell sx={{ width: "16%" }}>Flow</TableCell>
                            <TableCell sx={{ width: "18%" }}>Contexto</TableCell>
                            <TableCell sx={{ width: "10%" }}>Tareas</TableCell>
                            <TableCell sx={{ width: "16%" }}>Estado</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredFlowRows.map((row) => (
                            <TableRow
                              key={row.rowId}
                              hover
                              onClick={() => navigate(`/workflows/${row.workflowId}`)}
                              sx={{ cursor: "pointer" }}
                            >
                              <TableCell>
                                <Typography sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                                  {row.workflow.objetivo_final?.trim() || `Flow ${row.workflowId.slice(0, 8)}`}
                                </Typography>
                              </TableCell>
                              <TableCell>{row.workflowId.slice(0, 8)}</TableCell>
                              <TableCell>{getPrimaryDetail(row.trigger)}</TableCell>
                              <TableCell>{row.workflow.steps.length === 1 ? "1 tarea" : `${row.workflow.steps.length} tareas`}</TableCell>
                              <TableCell>
                                <StatusBadge value={getWorkflowDisplayStatus(row.workflow, row.trigger)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
                      {filteredFlowRows.map((row) => (
                        <Card key={row.rowId} sx={{ cursor: "pointer" }} onClick={() => navigate(`/workflows/${row.workflowId}`)}>
                          <CardContent>
                            <Stack spacing={1}>
                              <Typography sx={{ fontWeight: 700 }}>{getPrimaryDetail(row.trigger)}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Flow {row.workflowId.slice(0, 8)} · {row.workflow.objetivo_final?.trim() || "Sin título"}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                                <Chip size="small" variant="outlined" label={row.workflow.steps.length === 1 ? "1 tarea" : `${row.workflow.steps.length} tareas`} />
                                <StatusBadge value={getWorkflowDisplayStatus(row.workflow, row.trigger)} />
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary">
        Ultima actualizacion: {triggers[0] ? formatDate(triggers[0].fecha_actualizacion) : "sin datos"}
      </Typography>
    </Stack>
  );
}
