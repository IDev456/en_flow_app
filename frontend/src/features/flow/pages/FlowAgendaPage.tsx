import { useEffect, useMemo, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { alpha } from "@mui/material/styles";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { PageContainer } from "../../../components/layout/PageContainer";
import { getWorkflow, listActiveWorkflows, listTriggers, updateStep } from "../api";
import { FlowAgendaTimeline } from "../components/FlowAgendaTimeline";
import { navigateWithOrigin } from "../navigation";
import type { TriggerDetail, WorkflowDetail } from "../types";
import { buildFlowRows, getLatestMovementAt, pickRelevantStep, type FlowTableItem } from "../utils/flowTable";
import { buildFlowAgendaModel } from "../utils/flowAgenda";
import {
  activeAmbitoOptions,
  getRelativeCalendarDateInput,
  getTodayLocalDateInput,
  getStoredActiveAmbito,
  getVisibleWorkflowStatus,
  matchesActiveAmbito,
  setStoredActiveAmbito,
  toCalendarDateUtcIso,
  type ActiveAmbitoMode,
} from "../utils";

const DEFAULT_VISIBLE_DAYS = 21;

function getAmbitoModeIcon(ambito: ActiveAmbitoMode) {
  if (ambito === "laboral") return <WorkOutlineRoundedIcon sx={{ fontSize: 14 }} />;
  return <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />;
}

export function FlowAgendaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [activeAmbito, setActiveAmbito] = useState<ActiveAmbitoMode>(() => getStoredActiveAmbito());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => getTodayLocalDateInput(), []);
  const [visibleStartDateInput, setVisibleStartDateInput] = useState(() => getRelativeCalendarDateInput(-7, getTodayLocalDateInput()));

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setStoredActiveAmbito(activeAmbito);
  }, [activeAmbito]);

  async function loadData(options: { silent?: boolean } = {}) {
    const silent = options.silent ?? false;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [triggerData, activeWorkflowSummaries] = await Promise.all([listTriggers(), listActiveWorkflows()]);
      const workflowIds = [...new Set(activeWorkflowSummaries.map((workflow) => workflow.id))];
      const workflowDetails = await Promise.all(workflowIds.map((workflowId) => getWorkflow(workflowId)));

      setTriggers(triggerData);
      setWorkflowsById(Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda");
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const agendaSourceItems = useMemo<FlowTableItem[]>(() => {
    return Object.values(workflowsById)
      .filter((workflow) => matchesActiveAmbito(workflow.ambito, activeAmbito))
      .map((workflow) => ({
        workflow,
        linkedRequirements: requirementByWorkflowId[workflow.id] ?? [],
        displayStatus: getVisibleWorkflowStatus(workflow),
        relevantStep: pickRelevantStep(workflow),
        latestMovementAt: getLatestMovementAt(workflow),
      }));
  }, [activeAmbito, requirementByWorkflowId, workflowsById]);

  const flowRows = useMemo(() => buildFlowRows(agendaSourceItems, today), [agendaSourceItems, today]);
  const agendaModel = useMemo(
    () =>
      buildFlowAgendaModel(flowRows, today, {
        visibleStartDateInput,
        visibleDays: DEFAULT_VISIBLE_DAYS,
      }),
    [flowRows, today, visibleStartDateInput]
  );

  function handleWorkflowOpen(workflowId: string) {
    navigateWithOrigin(navigate, location, `/workflows/${workflowId}`, "/agenda");
  }

  function handleChangeActiveAmbito(nextAmbito: ActiveAmbitoMode | null) {
    if (!nextAmbito) {
      return;
    }
    setActiveAmbito(nextAmbito);
  }

  function handleShowPreviousRange() {
    setVisibleStartDateInput((current) => getRelativeCalendarDateInput(-7, current));
  }

  function handleShowNextRange() {
    setVisibleStartDateInput((current) => getRelativeCalendarDateInput(7, current));
  }

  function handleShowTodayRange() {
    setVisibleStartDateInput(getRelativeCalendarDateInput(-7, today));
  }

  async function handleExecutionDateChange(
    workflowId: string,
    stepId: string,
    nextDateInput: string,
    previousDateInput: string | null
  ) {
    const previousWorkflow = workflowsById[workflowId];
    if (!previousWorkflow) {
      throw new Error("No se encontró el flow para actualizar.");
    }

    const nextIsoValue = toCalendarDateUtcIso(nextDateInput);
    const previousIsoValue = previousDateInput ? toCalendarDateUtcIso(previousDateInput) : null;

    setWorkflowsById((current) => {
      const workflow = current[workflowId];
      if (!workflow) {
        return current;
      }

      return {
        ...current,
        [workflowId]: {
          ...workflow,
          fecha_ejecucion_actual: nextIsoValue,
          steps: workflow.steps.map((step) =>
            step.id === stepId ? { ...step, fecha_ejecucion_estimada: nextIsoValue } : step
          ),
        },
      };
    });

    try {
      await updateStep(stepId, { fecha_ejecucion_estimada: nextIsoValue });
      showToast("Fecha de ejecución actualizada.", "success");
    } catch (err) {
      setWorkflowsById((current) => {
        const workflow = current[workflowId];
        if (!workflow) {
          return current;
        }

        return {
          ...current,
          [workflowId]: {
            ...workflow,
            fecha_ejecucion_actual: previousIsoValue,
            steps: workflow.steps.map((step) =>
              step.id === stepId ? { ...step, fecha_ejecucion_estimada: previousIsoValue } : step
            ),
          },
        };
      });

      const message = err instanceof Error ? err.message : "No se pudo actualizar la fecha de ejecución.";
      showToast(message, "error");
      throw err;
    }
  }

  const actions = (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ width: "100%", alignItems: { xs: "stretch", md: "center" } }}>
      <Paper variant="outlined" sx={{ overflow: "hidden", width: { xs: "100%", sm: 260 } }}>
        <Tabs
          value={activeAmbito}
          onChange={(_, value: ActiveAmbitoMode | null) => handleChangeActiveAmbito(value)}
          variant="fullWidth"
          aria-label="Modo de ámbito"
          sx={{
            minHeight: 62,
            "& .MuiTabs-indicator": {
              height: 3,
            },
          }}
        >
          {activeAmbitoOptions.map((option) => {
            const isLaboral = option.value === "laboral";
            return (
              <Tab
                key={option.value}
                value={option.value}
                icon={getAmbitoModeIcon(option.value)}
                iconPosition="top"
                label={option.label}
                sx={{
                  minWidth: 0,
                  minHeight: 62,
                  px: 0.75,
                  py: 0.5,
                  textTransform: "none",
                  fontWeight: 500,
                  fontSize: "0.73rem",
                  letterSpacing: "0.01em",
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                  "& .MuiTab-iconWrapper": {
                    marginBottom: 0.25,
                  },
                  "& .MuiSvgIcon-root": {
                    fontSize: 16,
                    color: "text.secondary",
                  },
                  "&.Mui-selected": {
                    color: isLaboral ? "primary.main" : "secondary.main",
                    backgroundColor: (theme) =>
                      alpha(
                        isLaboral ? theme.palette.primary.main : theme.palette.secondary.main,
                        theme.palette.mode === "dark" ? 0.18 : 0.1
                      ),
                  },
                  "&.Mui-selected .MuiSvgIcon-root": {
                    color: isLaboral ? "primary.main" : "secondary.main",
                  },
                }}
              />
            );
          })}
        </Tabs>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          px: 1.1,
          py: 0.85,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minWidth: { xs: "100%", md: 180 },
        }}
      >
        <Chip label="Activos" color="primary" variant="outlined" />
        <IconButton color="inherit" aria-label="Refrescar agenda" onClick={() => void loadData({ silent: true })} disabled={refreshing}>
          {refreshing ? <CircularProgress size={18} /> : <RefreshRoundedIcon fontSize="small" />}
        </IconButton>
      </Paper>
    </Stack>
  );

  return (
    <PageContainer
      title="Agenda"
      subtitle="Vista temporal de ejecución, atrasos y recordatorios de flows."
      actions={actions}
    >
      {loading ? (
        <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Cargando agenda...</Typography>
        </Stack>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <IconButton color="inherit" size="small" onClick={() => void loadData()}>
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      ) : agendaModel.items.length === 0 ? (
        <Alert severity="info">No hay flows activos para mostrar en Agenda con el ámbito seleccionado.</Alert>
      ) : (
        <Stack spacing={1.25}>
          <Paper
            variant="outlined"
            sx={{
              px: 1.35,
              py: 1,
              bgcolor: (theme) => theme.palette.surfaceContainerLow,
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {agendaModel.items.length} {agendaModel.items.length === 1 ? "flow visible" : "flows visibles"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rango visible: {agendaModel.visibleStartDateInput} a {agendaModel.visibleEndDateInput}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Chip label="Activos" color="primary" variant="outlined" />
                <Chip label={`Hoy · ${agendaModel.todayInput}`} color="primary" />
              </Stack>
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              px: 1.25,
              py: 1,
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
              <Typography variant="body2" color="text.secondary">
                Navegación temporal
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" color="inherit" startIcon={<ArrowBackRoundedIcon />} onClick={handleShowPreviousRange}>
                  Semana anterior
                </Button>
                <Button size="small" variant="outlined" onClick={handleShowTodayRange}>
                  Hoy
                </Button>
                <Button size="small" variant="outlined" color="inherit" endIcon={<ArrowForwardRoundedIcon />} onClick={handleShowNextRange}>
                  Semana siguiente
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <FlowAgendaTimeline
            model={agendaModel}
            onWorkflowOpen={handleWorkflowOpen}
            onExecutionDateChange={handleExecutionDateChange}
          />
        </Stack>
      )}
    </PageContainer>
  );
}
