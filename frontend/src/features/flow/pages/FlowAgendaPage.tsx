import { useEffect, useMemo, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { alpha } from "@mui/material/styles";
import {
  Alert,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { PageContainer } from "../../../components/layout/PageContainer";
import { getWorkflow, listActiveWorkflows, listTriggers, updateStep, updateStepWaitingReminder } from "../api";
import { FlowAgendaTimeline } from "../components/FlowAgendaTimeline";
import { navigateWithOrigin } from "../navigation";
import type { TriggerDetail, WorkflowDetail } from "../types";
import { buildFlowRows, getLatestMovementAt, pickRelevantStep, type FlowTableItem } from "../utils/flowTable";
import { buildFlowAgendaModel, countFlowAgendaQuickFilters, type FlowAgendaQuickFilter } from "../utils/flowAgenda";
import {
  activeAmbitoOptions,
  DEFAULT_ACTOR,
  getRelativeCalendarDateInput,
  getStartOfWeekDateInput,
  getTodayLocalDateInput,
  getStoredActiveAmbito,
  getVisibleWorkflowStatus,
  matchesActiveAmbito,
  setStoredActiveAmbito,
  toCalendarDateUtcIso,
  type ActiveAmbitoMode,
} from "../utils";

const DEFAULT_VISIBLE_DAYS = 21;

const QUICK_FILTER_OPTIONS: Array<{ value: FlowAgendaQuickFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "next_week", label: "Semana próxima" },
  { value: "without_date", label: "Sin fecha" },
];

const QUICK_FILTER_LABELS: Record<FlowAgendaQuickFilter, string> = Object.fromEntries(
  QUICK_FILTER_OPTIONS.map((option) => [option.value, option.label])
) as Record<FlowAgendaQuickFilter, string>;

const AGENDA_TITLES: Record<FlowAgendaQuickFilter, string> = {
  all: "Agenda",
  today: "Agenda hoy",
  this_week: "Agenda esta semana",
  next_week: "Agenda semana próxima",
  without_date: "Agenda sin fecha",
};

const AGENDA_SUBTITLE_PREFIX: Record<FlowAgendaQuickFilter, string> = {
  all: "Activos y en espera",
  today: "Activos y en espera",
  this_week: "Activos y en espera",
  next_week: "Activos y en espera",
  without_date: "Flows activos sin fecha de ejecución y esperas sin recordatorio",
};

const AGENDA_EMPTY_STATE_MESSAGES: Record<FlowAgendaQuickFilter, string> = {
  all: "No hay flows operativos para mostrar en Agenda con el ámbito seleccionado.",
  today: "No hay flows en la agenda de hoy.",
  this_week: "No hay flows en la agenda de esta semana.",
  next_week: "No hay flows en la agenda de la semana próxima.",
  without_date: "No hay flows sin fecha para mostrar.",
};

function getAmbitoModeIcon(ambito: ActiveAmbitoMode) {
  if (ambito === "laboral") return <WorkOutlineRoundedIcon sx={{ fontSize: 14 }} />;
  return <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />;
}

function renderAgendaQuickFilterOptionLabel(
  option: { value: FlowAgendaQuickFilter; label: string },
  count: number,
  selected: boolean
) {
  const isDateHighlight = (option.value === "today" || option.value === "this_week" || option.value === "next_week") && count > 0;
  const isWithoutDateHighlight = option.value === "without_date" && count > 0;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: selected ? 500 : 400 }}>
        {option.label}
      </Typography>
      <Typography
        variant="body2"
        sx={(theme) => ({
          color: isWithoutDateHighlight
            ? theme.palette.warning.main
            : isDateHighlight
              ? theme.palette.status.active.accent
              : theme.palette.text.secondary,
          fontWeight: isWithoutDateHighlight || isDateHighlight ? 700 : 500,
        })}
      >
        ({count})
      </Typography>
    </Stack>
  );
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
  const [quickFilter, setQuickFilter] = useState<FlowAgendaQuickFilter>("all");
  const [quickFilterAnchorEl, setQuickFilterAnchorEl] = useState<HTMLElement | null>(null);

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
        filter: "all",
        quickFilter,
        visibleStartDateInput,
        visibleDays: DEFAULT_VISIBLE_DAYS,
      }),
    [flowRows, today, quickFilter, visibleStartDateInput]
  );
  const quickFilterCounts = useMemo(() => countFlowAgendaQuickFilters(flowRows, today), [flowRows, today]);

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

  function handleQuickFilterChange(next: FlowAgendaQuickFilter | null) {
    if (!next) return;
    setQuickFilter(next);
    if (next === "today") {
      setVisibleStartDateInput(getRelativeCalendarDateInput(-7, today));
    } else if (next === "this_week") {
      setVisibleStartDateInput(getStartOfWeekDateInput(0, today));
    } else if (next === "next_week") {
      setVisibleStartDateInput(getStartOfWeekDateInput(1, today));
    }
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

  async function handleWaitingReminderChange(
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
          fecha_recordatorio_actual: nextIsoValue,
          steps: workflow.steps.map((step) =>
            step.id === stepId ? { ...step, fecha_recordatorio_espera: nextIsoValue } : step
          ),
        },
      };
    });

    try {
      await updateStepWaitingReminder(stepId, {
        fecha_recordatorio_espera: nextIsoValue,
        usuario: DEFAULT_ACTOR,
      });
      showToast("Recordatorio de espera actualizado.", "success");
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
            fecha_recordatorio_actual: previousIsoValue,
            steps: workflow.steps.map((step) =>
              step.id === stepId ? { ...step, fecha_recordatorio_espera: previousIsoValue } : step
            ),
          },
        };
      });

      const message = err instanceof Error ? err.message : "No se pudo actualizar el recordatorio de espera.";
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

      <Paper variant="outlined" sx={{ px: 0.75, py: 0.5, display: "flex", alignItems: "center", gap: 0.25 }}>
        <ButtonBase
          aria-label="Filtro rápido de agenda"
          onClick={(event) => setQuickFilterAnchorEl(event.currentTarget)}
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: (theme) => `${theme.appShape.sm}px`,
            color: "text.secondary",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <ScheduleRoundedIcon fontSize="small" />
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {QUICK_FILTER_LABELS[quickFilter]}
            </Typography>
            <ExpandMoreIcon fontSize="small" />
          </Stack>
        </ButtonBase>
        {quickFilter !== "all" ? (
          <IconButton
            aria-label="Restablecer filtro rápido"
            size="small"
            onClick={() => {
              handleQuickFilterChange("all");
              setQuickFilterAnchorEl(null);
            }}
          >
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Menu anchorEl={quickFilterAnchorEl} open={Boolean(quickFilterAnchorEl)} onClose={() => setQuickFilterAnchorEl(null)}>
          {QUICK_FILTER_OPTIONS.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === quickFilter}
              onClick={() => {
                handleQuickFilterChange(option.value);
                setQuickFilterAnchorEl(null);
              }}
            >
              {renderAgendaQuickFilterOptionLabel(option, quickFilterCounts[option.value] ?? 0, option.value === quickFilter)}
            </MenuItem>
          ))}
        </Menu>
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
        <Chip label="Activos y en espera" color="primary" variant="outlined" />
        <IconButton color="inherit" aria-label="Refrescar agenda" onClick={() => void loadData({ silent: true })} disabled={refreshing}>
          {refreshing ? <CircularProgress size={18} /> : <RefreshRoundedIcon fontSize="small" />}
        </IconButton>
      </Paper>
    </Stack>
  );

  return (
    <PageContainer
      title={AGENDA_TITLES[quickFilter]}
      subtitle={`${AGENDA_SUBTITLE_PREFIX[quickFilter]} · ${agendaModel.items.length} ${agendaModel.items.length === 1 ? "flow visible" : "flows visibles"}`}
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
      ) : (
        <Stack spacing={1.25}>
          {agendaModel.items.length === 0 ? (
            <Alert severity="info">{AGENDA_EMPTY_STATE_MESSAGES[quickFilter]}</Alert>
          ) : (
            <>
              <Paper
                variant="outlined"
                sx={{
                  px: 1.35,
                  py: 1,
                  bgcolor: (theme) => theme.palette.surfaceContainerLow,
                }}
              >
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
                  <Typography variant="caption" color="text.secondary">
                    Rango visible: {agendaModel.visibleStartDateInput} a {agendaModel.visibleEndDateInput}
                  </Typography>
                  <Chip label={`Hoy · ${agendaModel.todayInput}`} color="primary" />
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
                onWaitingReminderChange={handleWaitingReminderChange}
              />
            </>
          )}
        </Stack>
      )}
    </PageContainer>
  );
}
