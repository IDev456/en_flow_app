import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ColumnsPanelTrigger,
  DataGrid,
  ExportCsv,
  FilterPanelTrigger,
  GridActionsCellItem,
  type GridColDef,
  type GridFilterModel,
  type GridRowParams,
  Toolbar,
  ToolbarButton,
} from "@mui/x-data-grid";
import { useLocation, useNavigate } from "react-router-dom";

import { PageContainer } from "../../../components/layout/PageContainer";
import { cancelWorkflow, createTrigger, deleteTrigger, deleteWorkflow, getWorkflow, listTriggers, listWorkflows, reactivateWorkflow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, TriggerDetail, WorkflowDetail } from "../types";
import { formatDateOnly, formatElapsedTime, getStatusTone } from "../utils";

type ViewMode = "requirements" | "flows";
type FlowFilter = "all" | "active" | "waiting" | "finalized" | "cancelled";

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

type FlowGridRow = {
  id: string;
  status: string;
  taskName: string;
  stepLabel: string;
  executionDateLabel: string;
  executionAt: number;
  lastRecord: string;
  movementLabel: string;
  movementAt: number;
  requirementsLabel: string;
  requirementsCount: number;
  canCancel: boolean;
  canReactivate: boolean;
  canDelete: boolean;
};

type RequirementGridRow = {
  id: string;
  description: string;
  context: string;
  status: string;
  flowsLabel: string;
  waitingLabel: string;
  openCount: number;
  waitingCount: number;
  canDelete: boolean;
};

const flowFilterOptions: Array<{ value: FlowFilter; label: string }> = [
  { value: "active", label: "Activos" },
  { value: "waiting", label: "Esperando" },
  { value: "finalized", label: "Finalizados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

function getFilterIcon(filter: FlowFilter) {
  if (filter === "active") return <BoltRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "waiting") return <HourglassTopRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "finalized") return <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />;
  if (filter === "cancelled") return <CancelOutlinedIcon sx={{ fontSize: 14 }} />;
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
  if (tone === "cancelado") return "cancelled";
  if (tone === "finalizado" || tone === "completado" || tone === "resuelto") return "finalized";
  if (tone === "espera" || tone === "espera_externa" || statusValue === "en_espera") return "waiting";
  return "active";
}

function getDefaultFilterForView(view: ViewMode): FlowFilter {
  return view === "flows" ? "active" : "all";
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
  const hasOperationalStep = workflow.steps.some((step) =>
    ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
  );

  if (!workflow.steps.length) return false;
  if (["en_proceso", "esperando_respuesta", "en_espera", "con_problema"].includes(workflow.estado)) return true;
  if (workflow.estado === "pendiente") return hasOperationalStep;
  return false;
}

function canReactivateWorkflow(workflow: WorkflowDetail) {
  return workflow.estado === "cancelado";
}

function canDeleteWorkflow(workflow: WorkflowDetail) {
  return ["cancelado", "finalizado"].includes(workflow.estado);
}

function getDateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function toQuickFilterValues(search: string) {
  const normalized = search.trim();
  if (!normalized) return [];
  return normalized.split(/\s+/);
}

type GridToolbarProps = {
  quickFilterPlaceholder: string;
  searchOpen: boolean;
  searchValue: string;
  onSearchToggle: () => void;
  onSearchChange: (value: string) => void;
  onSearchClearOrClose: () => void;
};

export function TriggerListPage({ defaultView = "requirements", lockView = false, title = "Requerimientos" }: TriggerListPageProps) {
  const [triggers, setTriggers] = useState<TriggerDetail[]>([]);
  const [workflowsById, setWorkflowsById] = useState<Record<string, WorkflowDetail>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [stateFilter, setStateFilter] = useState<FlowFilter>(() => getDefaultFilterForView(defaultView));
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
  const [cancellingFlowId, setCancellingFlowId] = useState<string | null>(null);
  const [reactivatingFlowId, setReactivatingFlowId] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [flowSearchOpen, setFlowSearchOpen] = useState(false);
  const [flowSearchValue, setFlowSearchValue] = useState("");
  const [requirementSearchOpen, setRequirementSearchOpen] = useState(false);
  const [requirementSearchValue, setRequirementSearchValue] = useState("");
  const [flowFilterModel, setFlowFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });
  const [requirementFilterModel, setRequirementFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setViewMode(defaultView);
    setStateFilter(getDefaultFilterForView(defaultView));
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
      .filter((item) => {
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(item.displayStatus) === stateFilter;
      });
  }, [requirementByWorkflowId, stateFilter, workflowsById]);

  const flowCounts = useMemo(() => {
    return Object.values(workflowsById)
      .map((workflow) => getWorkflowDisplayStatus(workflow))
      .reduce<Record<Exclude<FlowFilter, "all">, number>>(
        (acc, status) => {
          acc[getFlowFilterFromStatus(status)] += 1;
          return acc;
        },
        { active: 0, waiting: 0, finalized: 0, cancelled: 0 }
      );
  }, [workflowsById]);

  const filteredRequirements = useMemo(
    () =>
      triggers.filter((trigger) => {
        if (stateFilter === "all") return true;
        return getFlowFilterFromStatus(trigger.estado_general) === stateFilter;
      }),
    [triggers, stateFilter]
  );

  const requirementCounts = useMemo(() => {
    return triggers.reduce<Record<Exclude<FlowFilter, "all">, number>>(
      (acc, trigger) => {
        acc[getFlowFilterFromStatus(trigger.estado_general)] += 1;
        return acc;
      },
      { active: 0, waiting: 0, finalized: 0, cancelled: 0 }
    );
  }, [triggers]);

  const flowRows = useMemo<FlowGridRow[]>(() => {
    return flowCards.map((item) => {
      const step = item.relevantStep;
      const stepLabel =
        step && ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado)
          ? "Tarea actual"
          : "Última tarea";
      const movementAt = getDateValue(item.latestMovementAt) ?? 0;
      return {
        id: item.workflow.id,
        status: item.displayStatus,
        taskName: step?.nombre ?? "Sin tarea registrada",
        stepLabel,
        executionDateLabel: step?.fecha_ejecucion_estimada ? formatDateOnly(step.fecha_ejecucion_estimada) : "Sin fecha",
        executionAt: getDateValue(step?.fecha_ejecucion_estimada) ?? Number.MAX_SAFE_INTEGER,
        lastRecord: getStepRecord(step),
        movementLabel: formatElapsedTime(item.latestMovementAt) ?? "Sin movimiento reciente",
        movementAt: movementAt || Number.MAX_SAFE_INTEGER,
        requirementsLabel:
          item.linkedRequirements.length === 0
            ? "Sin requerimientos"
            : item.linkedRequirements.map((requirement) => requirement.descripcion?.trim() || `Req ${requirement.id.slice(0, 8)}`).join(" · "),
        requirementsCount: item.linkedRequirements.length,
        canCancel: canCancelWorkflow(item.workflow),
        canReactivate: canReactivateWorkflow(item.workflow),
        canDelete: canDeleteWorkflow(item.workflow),
      };
    });
  }, [flowCards]);

  const requirementRows = useMemo<RequirementGridRow[]>(() => {
    return filteredRequirements.map((trigger) => {
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

      return {
        id: trigger.id,
        description: trigger.descripcion?.trim() || "Requerimiento sin detalle",
        context: trigger.solicitante?.trim() || "Sin contexto",
        status: trigger.estado_general,
        flowsLabel:
          linkedWorkflows.length === 0
            ? "Sin flows"
            : openCount > 0
              ? `${linkedWorkflows.length} flows · ${openCount} abiertos`
              : `${linkedWorkflows.length} flows`,
        waitingLabel: waitingCount > 0 ? `Esperando: ${waitingCount}` : "",
        openCount,
        waitingCount,
        canDelete: trigger.workflow_ids.length === 0,
      };
    });
  }, [filteredRequirements, workflowsById]);

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

  async function handleCancelFlowAction(workflowId: string) {
    const workflow = workflowsById[workflowId];
    if (!workflow || !canCancelWorkflow(workflow)) return;
    const currentTask = pickRelevantStep(workflow)?.nombre?.trim() || workflow.objetivo_final?.trim() || "Flow sin tarea actual";

    const confirmed = window.confirm(
      `¿Cancelar este flow?\n\n${currentTask}\n\nEl flow saldrá de la operación activa y pasará a Cancelados.\nNo se eliminarán tareas, comentarios ni requerimientos vinculados.\nSi fue un error, luego podrás reactivarlo.`
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

  async function handleReactivateFlowAction(workflowId: string) {
    const workflow = workflowsById[workflowId];
    if (!workflow || !canReactivateWorkflow(workflow)) return;
    const currentTask = pickRelevantStep(workflow)?.nombre?.trim() || workflow.objetivo_final?.trim() || "Flow sin tarea actual";

    const confirmed = window.confirm(
      `¿Reactivar este flow?\n\n${currentTask}\n\nEl flow volverá a la operación y saldrá de Cancelados.\nNo se eliminarán tareas, comentarios ni requerimientos vinculados.`
    );
    if (!confirmed) return;

    try {
      setReactivatingFlowId(workflowId);
      setError(null);
      await reactivateWorkflow(workflowId);
      await loadData();
      setFlowToastMessage("Flow reactivado.");
      setFlowToastOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reactivar el flow.");
    } finally {
      setReactivatingFlowId(null);
    }
  }

  async function handleDeleteFlowAction(workflowId: string) {
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

  function openCaptureModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("modal", "capture");
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  const isFlowsView = viewMode === "flows";
  const pageTitle = title || (isFlowsView ? "Flows" : "Requerimientos");
  const currentCounts = isFlowsView ? flowCounts : requirementCounts;

  const flowColumns = useMemo<GridColDef<FlowGridRow>[]>(
    () => [
      {
        field: "status",
        headerName: "Estado",
        width: 140,
        minWidth: 135,
        sortable: false,
        renderCell: (params) => <StatusBadge value={params.value} />,
      },
      {
        field: "taskName",
        headerName: "Tarea actual",
        flex: 1.45,
        minWidth: 280,
        valueGetter: (_, row) => `${row.stepLabel} ${row.taskName}`,
        renderCell: (params) => {
          const row = params.row;
          return (
            <Stack spacing={0.35} sx={{ minWidth: 0, py: 0.15 }}>
              <Typography variant="caption" color="text.secondary">
                {row.stepLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                }}
              >
                {row.taskName}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "lastRecord",
        headerName: "Último registro",
        flex: 1.35,
        minWidth: 300,
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "executionAt",
        headerName: "Fecha",
        width: 130,
        minWidth: 120,
        type: "number",
        valueGetter: (_, row) => row.executionAt,
        renderCell: (params) => (
          <Typography variant="body2" color={params.row.executionDateLabel === "Sin fecha" ? "text.secondary" : "text.primary"}>
            {params.row.executionDateLabel}
          </Typography>
        ),
      },
      {
        field: "movementAt",
        headerName: "Movimiento",
        width: 126,
        minWidth: 120,
        type: "number",
        renderCell: (params) => (
          <Typography variant="caption" color="text.secondary">
            {params.row.movementLabel}
          </Typography>
        ),
      },
      {
        field: "requirementsLabel",
        headerName: "Requerimientos",
        flex: 1.2,
        minWidth: 260,
        sortable: false,
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Acciones",
        width: 110,
        getActions: (params) => {
          const row = params.row;
          return [
            <GridActionsCellItem
              key="open"
              icon={<LaunchRoundedIcon fontSize="small" />}
              label="Abrir flow"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/workflows/${row.id}`);
              }}
              showInMenu={false}
            />,
            ...(row.canCancel
              ? [
                  <GridActionsCellItem
                    key="cancel"
                    icon={<CancelOutlinedIcon fontSize="small" />}
                    label={cancellingFlowId === row.id ? "Cancelando..." : "Cancelar flow"}
                    disabled={Boolean(cancellingFlowId || deletingFlowId || reactivatingFlowId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCancelFlowAction(row.id);
                    }}
                    showInMenu
                  />,
                ]
              : []),
            ...(row.canReactivate
              ? [
                  <GridActionsCellItem
                    key="reactivate"
                    icon={<RestartAltRoundedIcon fontSize="small" />}
                    label={reactivatingFlowId === row.id ? "Reactivando..." : "Reactivar flow"}
                    disabled={Boolean(reactivatingFlowId || cancellingFlowId || deletingFlowId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleReactivateFlowAction(row.id);
                    }}
                    showInMenu
                  />,
                ]
              : []),
            ...(row.canDelete
              ? [
                  <GridActionsCellItem
                    key="delete"
                    icon={<DeleteOutlineRoundedIcon fontSize="small" />}
                    label={deletingFlowId === row.id ? "Eliminando..." : "Eliminar flow"}
                    disabled={Boolean(deletingFlowId || cancellingFlowId || reactivatingFlowId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteFlowAction(row.id);
                    }}
                    showInMenu
                  />,
                ]
              : []),
          ];
        },
      },
    ],
    [cancellingFlowId, deletingFlowId, navigate, reactivatingFlowId]
  );

  const requirementColumns = useMemo<GridColDef<RequirementGridRow>[]>(
    () => [
      {
        field: "description",
        headerName: "Requerimiento",
        flex: 1.5,
        minWidth: 280,
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "context",
        headerName: "Contexto",
        flex: 1.1,
        minWidth: 220,
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              lineHeight: 1.3,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: "Estado",
        width: 150,
        minWidth: 140,
        sortable: false,
        renderCell: (params) => <StatusBadge value={params.value} />,
      },
      {
        field: "flowsLabel",
        headerName: "Flows vinculados",
        flex: 1,
        minWidth: 220,
        renderCell: (params) => {
          const row = params.row;
          return (
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.4 }}>
              <Chip size="small" variant="outlined" label={row.flowsLabel} />
              {row.waitingLabel ? <Chip size="small" variant="outlined" label={row.waitingLabel} /> : null}
            </Stack>
          );
        },
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Acciones",
        width: 116,
        getActions: (params) => {
          const row = params.row;
          return [
            <GridActionsCellItem
              key="open"
              icon={<LaunchRoundedIcon fontSize="small" />}
              label="Abrir requerimiento"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/requirements/${row.id}`);
              }}
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteOutlineRoundedIcon fontSize="small" />}
              label={deletingTriggerId === row.id ? "Eliminando..." : "Eliminar requerimiento"}
              disabled={!row.canDelete || Boolean(deletingTriggerId)}
              onClick={(event) => {
                event.stopPropagation();
                const trigger = triggers.find((item) => item.id === row.id);
                if (!trigger) return;
                void handleDeleteTrigger(trigger);
              }}
              showInMenu
            />,
          ];
        },
      },
    ],
    [deletingTriggerId, navigate, triggers]
  );

  function GridToolbar({
    quickFilterPlaceholder,
    searchOpen,
    searchValue,
    onSearchToggle,
    onSearchChange,
    onSearchClearOrClose,
  }: GridToolbarProps) {
    const searchIsEmpty = searchValue.trim().length === 0;

    return (
      <Toolbar aria-label="Toolbar del listado" style={{ gap: "6px", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <ToolbarButton aria-label={searchOpen ? "Alternar búsqueda" : "Buscar"} onClick={onSearchToggle}>
            <SearchRoundedIcon fontSize="small" />
          </ToolbarButton>
          {searchOpen ? (
            <>
              <TextField
                aria-label="Búsqueda rápida"
                placeholder={quickFilterPlaceholder}
                size="small"
                fullWidth={false}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && searchIsEmpty) {
                    onSearchClearOrClose();
                  }
                }}
                sx={{ width: { xs: 180, sm: 280 } }}
              />
              <ToolbarButton
                aria-label={searchIsEmpty ? "Cerrar búsqueda" : "Limpiar búsqueda"}
                onClick={onSearchClearOrClose}
              >
                <CancelOutlinedIcon fontSize="small" />
              </ToolbarButton>
            </>
          ) : null}
        </Stack>

        <Box sx={{ flex: 1 }} />

        <ColumnsPanelTrigger
          aria-label="Columnas"
          render={<ToolbarButton aria-label="Columnas">{<ViewColumnRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
        <FilterPanelTrigger
          aria-label="Filtros"
          render={<ToolbarButton aria-label="Filtros">{<FilterListRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
        <ExportCsv
          aria-label="Descargar"
          render={<ToolbarButton aria-label="Descargar CSV">{<DownloadRoundedIcon fontSize="small" />}</ToolbarButton>}
        />
      </Toolbar>
    );
  }

  return (
    <Stack spacing={2.1}>
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
        actions={
          <>
            <Tooltip title="Refrescar">
              <IconButton color="inherit" aria-label="Refrescar listado" onClick={() => void loadData()}>
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
        <Stack spacing={1.2}>
          {!lockView && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, value: ViewMode | null) => {
                if (!value) return;
                setViewMode(value);
                setStateFilter(getDefaultFilterForView(value));
                setCreateRequirementOpen(false);
                setCreateRequirementError(null);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              <ToggleButton value="flows">Flows</ToggleButton>
              <ToggleButton value="requirements">Requerimientos</ToggleButton>
            </ToggleButtonGroup>
          )}

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

          {error && <Alert severity="error">{error}</Alert>}

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", md: "center" },
              gap: 0.85,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Estado
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={stateFilter}
              onChange={(_, value: FlowFilter | null) => {
                if (value) setStateFilter(value);
              }}
              sx={{ flexWrap: "wrap", rowGap: 0.55 }}
            >
              {flowFilterOptions.map((option) => {
                const countLabel = option.value === "all" ? "" : ` (${currentCounts[option.value] ?? 0})`;
                return (
                  <ToggleButton key={option.value} value={option.value}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
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
          </Box>

          <Paper sx={{ overflow: "hidden" }}>
            {loading ? (
              <Stack direction="row" spacing={1.25} sx={{ py: 5, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando...</Typography>
              </Stack>
            ) : isFlowsView ? (
              <Box
                sx={{
                  height: {
                    xs: "calc(100dvh - 320px)",
                    md: "calc(100dvh - 300px)",
                  },
                  minHeight: { xs: 520, md: 720 },
                  width: "100%",
                }}
              >
                <DataGrid
                  rows={flowRows}
                  columns={flowColumns}
                  rowHeight={68}
                  filterModel={flowFilterModel}
                  onFilterModelChange={setFlowFilterModel}
                  disableRowSelectionOnClick
                  showToolbar
                  onRowClick={(params: GridRowParams<FlowGridRow>) => {
                    navigate(`/workflows/${params.row.id}`);
                  }}
                  slots={{
                    toolbar: () => (
                      <GridToolbar
                        quickFilterPlaceholder="Buscar flow, tarea o requerimiento vinculado..."
                        searchOpen={flowSearchOpen}
                        searchValue={flowSearchValue}
                        onSearchToggle={() => {
                          if (flowSearchOpen && flowSearchValue.trim().length === 0) {
                            setFlowSearchOpen(false);
                            return;
                          }
                          setFlowSearchOpen(true);
                        }}
                        onSearchChange={(value) => {
                          setFlowSearchValue(value);
                          setFlowFilterModel((previous) => ({
                            ...previous,
                            quickFilterValues: toQuickFilterValues(value),
                          }));
                        }}
                        onSearchClearOrClose={() => {
                          if (flowSearchValue.trim().length > 0) {
                            setFlowSearchValue("");
                            setFlowFilterModel((previous) => ({
                              ...previous,
                              quickFilterValues: [],
                            }));
                            return;
                          }
                          setFlowSearchOpen(false);
                        }}
                      />
                    ),
                  }}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: "movementAt", sort: "asc" }],
                    },
                    pagination: {
                      paginationModel: { pageSize: 20, page: 0 },
                    },
                  }}
                  pageSizeOptions={[10, 15, 20, 50]}
                  sx={{ border: 0, height: "100%" }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  height: {
                    xs: "calc(100dvh - 320px)",
                    md: "calc(100dvh - 300px)",
                  },
                  minHeight: { xs: 520, md: 680 },
                  width: "100%",
                }}
              >
                <DataGrid
                  rows={requirementRows}
                  columns={requirementColumns}
                  rowHeight={64}
                  filterModel={requirementFilterModel}
                  onFilterModelChange={setRequirementFilterModel}
                  disableRowSelectionOnClick
                  showToolbar
                  onRowClick={(params: GridRowParams<RequirementGridRow>) => {
                    navigate(`/requirements/${params.row.id}`);
                  }}
                  slots={{
                    toolbar: () => (
                      <GridToolbar
                        quickFilterPlaceholder="Buscar requerimiento o contexto..."
                        searchOpen={requirementSearchOpen}
                        searchValue={requirementSearchValue}
                        onSearchToggle={() => {
                          if (requirementSearchOpen && requirementSearchValue.trim().length === 0) {
                            setRequirementSearchOpen(false);
                            return;
                          }
                          setRequirementSearchOpen(true);
                        }}
                        onSearchChange={(value) => {
                          setRequirementSearchValue(value);
                          setRequirementFilterModel((previous) => ({
                            ...previous,
                            quickFilterValues: toQuickFilterValues(value),
                          }));
                        }}
                        onSearchClearOrClose={() => {
                          if (requirementSearchValue.trim().length > 0) {
                            setRequirementSearchValue("");
                            setRequirementFilterModel((previous) => ({
                              ...previous,
                              quickFilterValues: [],
                            }));
                            return;
                          }
                          setRequirementSearchOpen(false);
                        }}
                      />
                    ),
                  }}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: "description", sort: "asc" }],
                    },
                    pagination: {
                      paginationModel: { pageSize: 20, page: 0 },
                    },
                  }}
                  pageSizeOptions={[10, 15, 20, 50]}
                  sx={{ border: 0, height: "100%" }}
                />
              </Box>
            )}
          </Paper>

          {!loading && isFlowsView && flowRows.length === 0 && <Alert severity="info">No hay flows para este filtro.</Alert>}
          {!loading && !isFlowsView && requirementRows.length === 0 && (
            <Alert severity="info">No hay requerimientos para este filtro.</Alert>
          )}
        </Stack>
      </PageContainer>
    </Stack>
  );
}
