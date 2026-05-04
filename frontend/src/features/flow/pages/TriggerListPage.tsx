import { useEffect, useState } from "react";
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

type TriggerFilter = "all" | "in_progress" | "waiting" | "problem" | "done" | "without_flow";

export function TriggerListPage() {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TriggerFilter>("all");
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

  function getWorkflowIdForTrigger(trigger: TriggerDetail) {
    if (trigger.workflow_activo_id) {
      return trigger.workflow_activo_id;
    }

    if (trigger.workflow_ids.length === 0) {
      return null;
    }

    return trigger.workflow_ids[trigger.workflow_ids.length - 1];
  }

  async function handleOpen(trigger: TriggerDetail) {
    const workflowId = getWorkflowIdForTrigger(trigger);
    if (workflowId) {
      navigate(`/workflows/${workflowId}`);
      return;
    }

    navigate(`/triggers/${trigger.id}`);
  }

  function getWorkflowForTrigger(trigger: TriggerDetail) {
    const workflowId = getWorkflowIdForTrigger(trigger);
    return workflowId ? workflowsById[workflowId] : undefined;
  }

  function getPrimaryDetail(trigger: TriggerDetail) {
    return trigger.descripcion?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequester(trigger: TriggerDetail) {
    return trigger.solicitante?.trim() || "Sin solicitante";
  }

  function getDisplayStatus(trigger: TriggerDetail) {
    const workflow = getWorkflowForTrigger(trigger);
    if (!workflow) return trigger.estado_general;

    if (workflow.estado === "finalizado" || workflow.estado === "cancelado") {
      return workflow.estado;
    }

    if (workflow.estado === "en_proceso") {
      const currentStep = workflow.steps.find((step) => step.estado !== "completado");
      if (currentStep?.estado === "problema") return "problema";
      if (currentStep?.estado === "espera") return "espera";
    }

    return workflow.estado;
  }

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

  function isWithoutWorkflow(trigger: TriggerDetail) {
    return trigger.workflow_ids.length === 0 && trigger.estado_general !== "resuelto";
  }

  function getFilterBucket(trigger: TriggerDetail): Exclude<TriggerFilter, "all"> {
    if (isWithoutWorkflow(trigger)) {
      return "without_flow";
    }

    const tone = getStatusTone(getDisplayStatus(trigger));
    if (tone === "problema") {
      return "problem";
    }
    if (tone === "espera") {
      return "waiting";
    }
    if (tone === "finalizado" || tone === "resuelto" || tone === "completado" || tone === "cancelado") {
      return "done";
    }
    return "in_progress";
  }

  const stateCounts = triggers.reduce<Record<Exclude<TriggerFilter, "all">, number>>(
    (acc, trigger) => {
      acc[getFilterBucket(trigger)] += 1;
      return acc;
    },
    { in_progress: 0, waiting: 0, problem: 0, done: 0, without_flow: 0 }
  );

  const filtered = triggers.filter((trigger) => {
    if (filter !== "all" && getFilterBucket(trigger) !== filter) {
      return false;
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    const haystack = `${trigger.id} ${trigger.solicitante ?? ""} ${trigger.descripcion ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });

  const activeCount = stateCounts.in_progress + stateCounts.waiting + stateCounts.problem;
  const completedCount = stateCounts.done;
  const withoutWorkflowCount = stateCounts.without_flow;
  const totalCreatedSteps = triggers.reduce((sum, trigger) => sum + (getWorkflowForTrigger(trigger)?.steps.length ?? 0), 0);

  const kpis = [
    { label: "Activos", value: activeCount, helper: "Requerimientos con flujo en curso" },
    { label: "Completados", value: completedCount, helper: "Casos cerrados correctamente" },
    { label: "Sin flujo", value: withoutWorkflowCount, helper: "Requieren definir paso inicial" },
    { label: "Pasos creados", value: totalCreatedSteps, helper: "Total generado entre todos los requerimientos" },
  ];

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
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
            >
              <Box>
                <Typography variant="h2">Requerimientos</Typography>
              </Box>
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
                value={filter}
                onChange={(_, value: TriggerFilter | null) => {
                  if (value) {
                    setFilter(value);
                  }
                }}
                sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", lg: "flex-end" }, rowGap: 0.75 }}
              >
                <ToggleButton value="all">Todos</ToggleButton>
                <ToggleButton value="in_progress">En proceso ({stateCounts.in_progress})</ToggleButton>
                <ToggleButton value="waiting">En espera ({stateCounts.waiting})</ToggleButton>
                <ToggleButton value="problem">Con problema ({stateCounts.problem})</ToggleButton>
                <ToggleButton value="done">Completados ({stateCounts.done})</ToggleButton>
                <ToggleButton value="without_flow">Sin flujo ({stateCounts.without_flow})</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {!loading && !error && (
              <Typography variant="body2" color="text.secondary">
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}. Haz click en un requerimiento para abrir su flujo activo o revisar el detalle si aun no tiene workflow.
              </Typography>
            )}

            {loading && (
              <Stack direction="row" spacing={1.5} sx={{ py: 6, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando requerimientos...</Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && filtered.length === 0 && (
              <Alert severity="info">No hay requerimientos que coincidan con tu búsqueda actual.</Alert>
            )}

            {!loading && !error && filtered.length > 0 && (
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
                        <TableCell sx={{ width: "58%" }}>Detalle</TableCell>
                        <TableCell sx={{ width: "16%" }}>Solicitante</TableCell>
                        <TableCell sx={{ width: "10%" }}>Pasos</TableCell>
                        <TableCell align="right">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((trigger) => {
                        const workflow = getWorkflowForTrigger(trigger);
                        const stepCount = workflow?.steps.length ?? 0;
                        const displayStatus = getDisplayStatus(trigger);

                        return (
                          <TableRow
                            key={trigger.id}
                            hover
                            onClick={() => void handleOpen(trigger)}
                            className="hover-entity-parent"
                            sx={{ cursor: "pointer" }}
                          >
                            <TableCell>
                              <Box sx={{ position: "relative", pr: 11 }}>
                                <HoverEntityActions
                                  onDelete={deletingTriggerId ? undefined : () => void handleDeleteTrigger(trigger)}
                                  sx={{ top: -2, right: 0 }}
                                />
                                <Stack spacing={0.5}>
                                  <Typography sx={{ fontWeight: 700, wordBreak: "break-word" }}>
                                    {getPrimaryDetail(trigger)}
                                  </Typography>
                                </Stack>
                              </Box>
                            </TableCell>
                            <TableCell>{getSecondaryRequester(trigger)}</TableCell>
                            <TableCell>{stepCount === 1 ? "1 paso" : `${stepCount} pasos`}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
                                <StatusBadge value={displayStatus} />
                                {isWithoutWorkflow(trigger) && (
                                  <Chip label="sin flujo" size="small" variant="outlined" />
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
                  {filtered.map((trigger) => {
                    const workflow = getWorkflowForTrigger(trigger);
                    const stepCount = workflow?.steps.length ?? 0;
                    const displayStatus = getDisplayStatus(trigger);

                    return (
                      <Card
                        key={trigger.id}
                        className="hover-entity-parent"
                        sx={{ cursor: "pointer", position: "relative" }}
                        onClick={() => void handleOpen(trigger)}
                      >
                        <HoverEntityActions
                          onDelete={deletingTriggerId ? undefined : () => void handleDeleteTrigger(trigger)}
                        />
                        <CardContent>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                              <Box>
                                <Typography variant="h6">{getPrimaryDetail(trigger)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {getSecondaryRequester(trigger)}
                                </Typography>
                              </Box>
                              <StatusBadge value={displayStatus} />
                            </Stack>

                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                              <Chip label={stepCount === 1 ? "1 paso" : `${stepCount} pasos`} size="small" variant="outlined" />
                              {isWithoutWorkflow(trigger) && (
                                <Chip label="sin flujo" size="small" variant="outlined" />
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
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
