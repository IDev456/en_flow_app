import { useEffect, useMemo, useState } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import { alpha } from "@mui/material/styles";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { getDailyBoard } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { DailyBoardData, Step, WorkflowSummary } from "../types";
import { formatCalendarDate, formatElapsedTime, getVisibleWorkflowStatusValue, isWaitingStepStatus } from "../utils";

export function DashboardPage() {
  const [board, setBoard] = useState<DailyBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadBoard();
  }, []);

  async function loadBoard() {
    try {
      setLoading(true);
      setError(null);
      setBoard(await getDailyBoard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }

  const waitingFollowUp = useMemo(
    () => [...(board?.tareas_en_pausa ?? []), ...(board?.tareas_con_problema ?? [])],
    [board?.tareas_en_pausa, board?.tareas_con_problema]
  );

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando bandeja...</Typography>
      </Stack>
    );
  }

  if (error || !board) {
    return <Alert severity="error">{error ?? "No se pudo cargar la bandeja"}</Alert>;
  }

  return (
    <Stack spacing={2.25}>
      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="subtitle2" color="primary.main">
                Bandeja
              </Typography>
              <Typography variant="h2">Con que seguis ahora?</Typography>
            </Box>
            <Button component={RouterLink} to="?modal=capture" variant="contained">
              Capturar tarea
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.25fr) minmax(0, 0.75fr)" },
        }}
      >
        <SectionCard
          title="Activas"
          subtitle="Lo mas importante para seguir ahora."
          items={board.tareas_activas}
          emptyTitle="No hay nada activo ahora"
          emptyDescription="Captura una tarea cuando aparezca algo para seguir."
          emphasized
        />

        <Stack spacing={2}>
          <SectionCard
            title="Esperando respuesta"
            subtitle="Pendientes de terceros."
            items={board.tareas_esperando_respuesta}
            emptyTitle="No hay respuestas pendientes"
            emptyDescription="Los temas que dependan de una respuesta externa apareceran aca."
          />
          <SectionCard
            title="En espera"
            subtitle="Temas que necesitan seguimiento antes de avanzar."
            items={waitingFollowUp}
            emptyTitle="No hay temas en espera"
            emptyDescription="Cuando algo quede trabado o pendiente de seguimiento, aparecera en esta seccion."
          />
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <FlowSection
          title="Flows recientes"
          items={board.flows_recientes}
          emptyTitle="Todavia no hay flows recientes"
          emptyDescription="Captura una tarea para iniciar el primero."
        />
        <FlowSection
          title="Cerradas recientes"
          items={board.flows_cerrados_recientes}
          emptyTitle="No hay cierres recientes"
          emptyDescription="Los flows finalizados apareceran aca por un tiempo."
        />
      </Box>
    </Stack>
  );
}

type SectionCardProps = {
  title: string;
  subtitle: string;
  items: Step[];
  emptyTitle: string;
  emptyDescription: string;
  emphasized?: boolean;
};

function SectionCard({ title, subtitle, items, emptyTitle, emptyDescription, emphasized = false }: SectionCardProps) {
  return (
    <Card sx={emphasized ? { borderColor: "primary.main" } : undefined}>
      <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>

          {items.length === 0 ? (
            <Alert severity="info">
              <Typography variant="subtitle1">{emptyTitle}</Typography>
              <Typography variant="body2">{emptyDescription}</Typography>
            </Alert>
          ) : (
            <Stack spacing={1.1}>
              {items.map((step) => (
                <WorkItemCard key={step.id} step={step} />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function WorkItemCard({ step }: { step: Step }) {
  const elapsed = formatElapsedTime(step.ultimo_comentario_fecha ?? step.fecha_estado_actual);
  const latest = step.ultimo_comentario?.trim();
  const isWaitingStep = isWaitingStepStatus(step.estado);
  const isWaitingExternal = step.estado === "esperando_respuesta";
  const timingLabel = isWaitingStep
    ? `Esperando desde: ${formatCalendarDate(step.fecha_estado_actual)}`
    : step.fecha_ejecucion_estimada
      ? `Fecha operativa: ${formatCalendarDate(step.fecha_ejecucion_estimada)}`
      : "Sin fecha operativa";
  const followUpLabel = isWaitingStep
    ? step.fecha_recordatorio_espera
      ? `Recordatorio de espera: ${formatCalendarDate(step.fecha_recordatorio_espera)}`
      : "Sin recordatorio de espera"
    : step.fecha_vencimiento
      ? `${isWaitingExternal ? "Seguimiento" : "Recordatorio"}: ${formatCalendarDate(step.fecha_vencimiento)}`
      : (isWaitingExternal ? "Sin seguimiento" : "Sin recordatorio");

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: (theme) => theme.appShape.md,
        boxShadow: "none",
        "&:hover": {
          borderColor: "primary.main",
        },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{step.nombre}</Typography>
              <Typography variant="body2" color="text.secondary">
                Tarea actual: #{step.orden}
              </Typography>
            </Box>
            <StatusBadge value={step.estado} />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Ultimo registro: {latest || "Sin registros todavia"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {timingLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {followUpLabel}
          </Typography>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.75 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <AccessTimeRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                {elapsed ?? "Sin movimiento reciente"}
              </Typography>
            </Stack>
            <Button component={RouterLink} to={`/steps/${step.id}`} size="small" endIcon={<LaunchRoundedIcon />} sx={{ px: 0.5 }}>
              Abrir tarea
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

type FlowSectionProps = {
  title: string;
  items: WorkflowSummary[];
  emptyTitle: string;
  emptyDescription: string;
};

function FlowSection({ title, items, emptyTitle, emptyDescription }: FlowSectionProps) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.25, md: 2.5 } }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">{title}</Typography>
          {items.length === 0 ? (
            <Alert severity="info">
              <Typography variant="subtitle1">{emptyTitle}</Typography>
              <Typography variant="body2">{emptyDescription}</Typography>
            </Alert>
          ) : (
            <Stack spacing={1}>
              {items.map((workflow) => (
                <Button
                  key={workflow.id}
                  component={RouterLink}
                  to={`/workflows/${workflow.id}`}
                  variant="outlined"
                  color="inherit"
                  sx={{
                    justifyContent: "space-between",
                    textTransform: "none",
                    borderRadius: (theme) => theme.appShape.md,
                    borderColor: (theme) => theme.palette.divider,
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.55),
                  }}
                >
                  <Box sx={{ textAlign: "left", minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {workflow.objetivo_final?.trim() || `Flow ${workflow.id.slice(0, 8)}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {workflow.pasos_activos.length > 0 ? `Tareas abiertas: ${workflow.pasos_activos.join(", ")}` : "Sin tareas abiertas"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                    <StatusBadge value={getVisibleWorkflowStatusValue(workflow.estado)} />
                    <PlaylistAddCheckRoundedIcon fontSize="small" />
                  </Stack>
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
