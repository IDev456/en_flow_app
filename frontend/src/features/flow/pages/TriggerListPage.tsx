import { useEffect, useMemo, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { alpha } from "@mui/material/styles";
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
  if (tone === "espera" || tone === "problema" || tone === "nuevo") {
    return "waiting";
  }
  return "in_progress";
}

function getFilterSx(filter: WorkflowStateFilter) {
  if (filter === "in_progress") {
    return {
      borderColor: alpha("#5fd1ff", 0.4),
      "&.Mui-selected": { color: "#072133", bgcolor: alpha("#5fd1ff", 0.92) },
    };
  }
  if (filter === "waiting") {
    return {
      borderColor: alpha("#ffbe55", 0.45),
      "&.Mui-selected": { color: "#2f1d06", bgcolor: alpha("#ffbe55", 0.96) },
    };
  }
  if (filter === "done") {
    return {
      borderColor: alpha("#53d88f", 0.45),
      "&.Mui-selected": { color: "#042514", bgcolor: alpha("#53d88f", 0.92) },
    };
  }
  return {};
}

export function TriggerListPage() {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("requirements");
  const [stateFilter, setStateFilter] = useState<WorkflowStateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deletingTriggerId, setDeletingTriggerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void loadData();
  }, []);

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
      setError(err instanceof Error ? err.message : "No se pudieron cargar los requerimientos");
    } finally {
      setLoading(false);
    }
  }

  function getPrimaryDetail(trigger: TriggerDetail) {
    return trigger.descripcion?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequester(trigger: TriggerDetail) {
    return trigger.solicitante?.trim() || "sistema";
  }

  function getWorkflowDisplayStatus(workflow: WorkflowDetail, trigger: TriggerDetail) {
    if (workflow.estado === "finalizado" || workflow.estado === "cancelado") {
      return workflow.estado;
    }
    if (workflow.estado === "en_proceso") {
      const openSteps = workflow.steps.filter((step) => step.estado !== "completado");
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
  const kpis = [
    { label: "Requerimientos", value: triggers.length, helper: "Total cargado en la bandeja operativa" },
    { label: "Flows activos", value: activeFlows, helper: "En proceso o en espera" },
    { label: "Flows completados", value: flowCounts.done, helper: "Finalizados o cancelados" },
    { label: "Pasos creados", value: totalCreatedSteps, helper: "Total de pasos de todos los flows" },
  ];

  const currentRowsCount = viewMode === "requirements" ? filteredRequirementRows.length : filteredFlowRows.length;
  const currentCounts = viewMode === "requirements" ? requirementCounts : flowCounts;

  return (
    <Stack spacing={3.5}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        {kpis.map((item) => (
          <Card key={item.label}>
            <CardContent sx={{ display: "grid", gap: 0.75 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h3">{item.value}</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.helper}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", lg: "center" } }}
            >
              <Typography variant="h2">Requerimientos</Typography>
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
            </Stack>

            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <TextField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por detalle, solicitante o id..."
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
                <Typography color="text.secondary">Cargando requerimientos...</Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && currentRowsCount === 0 && (
              <Alert severity="info">No hay resultados para la búsqueda y filtro actual.</Alert>
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
                        backgroundColor: alpha("#0c1324", 0.76),
                        overflow: "hidden",
                      }}
                    >
                      <Table sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "56%" }}>Detalle</TableCell>
                            <TableCell sx={{ width: "22%" }}>Solicitante</TableCell>
                            <TableCell sx={{ width: "10%" }}>Flows</TableCell>
                            <TableCell sx={{ width: "12%" }}>Pasos totales</TableCell>
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
                                onClick={() => navigate(`/triggers/${trigger.id}`)}
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
                                <TableCell>{stepCount === 1 ? "1 paso" : `${stepCount} pasos`}</TableCell>
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
                            onClick={() => navigate(`/triggers/${trigger.id}`)}
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
                                  <Chip label={stepCount === 1 ? "1 paso" : `${stepCount} pasos`} size="small" variant="outlined" />
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
                        backgroundColor: alpha("#0c1324", 0.76),
                        overflow: "hidden",
                      }}
                    >
                      <Table sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: "40%" }}>Requerimiento</TableCell>
                            <TableCell sx={{ width: "16%" }}>Workflow</TableCell>
                            <TableCell sx={{ width: "18%" }}>Solicitante</TableCell>
                            <TableCell sx={{ width: "10%" }}>Pasos</TableCell>
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
                                  {getPrimaryDetail(row.trigger)}
                                </Typography>
                              </TableCell>
                              <TableCell>{row.workflowId.slice(0, 8)}</TableCell>
                              <TableCell>{getSecondaryRequester(row.trigger)}</TableCell>
                              <TableCell>{row.workflow.steps.length === 1 ? "1 paso" : `${row.workflow.steps.length} pasos`}</TableCell>
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
                                Workflow {row.workflowId.slice(0, 8)} · {getSecondaryRequester(row.trigger)}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                                <Chip size="small" variant="outlined" label={row.workflow.steps.length === 1 ? "1 paso" : `${row.workflow.steps.length} pasos`} />
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
