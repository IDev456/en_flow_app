import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { getDailyBoard } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { DailyBoardData, Step, WorkflowSummary } from "../types";
import { formatDate } from "../utils";

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
    <Stack spacing={3}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="subtitle2" color="primary.light">
                Hoy
              </Typography>
              <Typography variant="h2">Bandeja operativa</Typography>
            </Box>
            <Button component={RouterLink} to="?modal=capture" variant="contained">
              + Capturar tarea
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" } }}>
        <StepColumn title="Activas" items={board.tareas_activas} empty="No hay tareas activas." />
        <StepColumn title="Esperando respuesta" items={board.tareas_esperando_respuesta} empty="No hay tareas esperando respuesta." />
        <StepColumn title="En pausa / problema" items={[...board.tareas_en_pausa, ...board.tareas_con_problema]} empty="No hay tareas en pausa o con problema." />
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h5">Flows recientes</Typography>
            {board.flows_recientes.length === 0 ? (
              <Alert severity="info">No hay flows recientes.</Alert>
            ) : (
              board.flows_recientes.map((workflow) => <WorkflowRow key={workflow.id} workflow={workflow} />)
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h5">Cerradas recientes</Typography>
            {board.flows_cerrados_recientes.length === 0 ? (
              <Alert severity="info">No hay cierres recientes.</Alert>
            ) : (
              board.flows_cerrados_recientes.map((workflow) => <WorkflowRow key={workflow.id} workflow={workflow} />)
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function StepColumn({ title, items, empty }: { title: string; items: Step[]; empty: string }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={1.25}>
          <Typography variant="h6">{title}</Typography>
          {items.length === 0 ? (
            <Alert severity="info">{empty}</Alert>
          ) : (
            items.map((step) => (
              <Button
                key={step.id}
                component={RouterLink}
                to={`/steps/${step.id}`}
                variant="outlined"
                color="inherit"
                sx={{ justifyContent: "space-between", textTransform: "none" }}
              >
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontWeight: 700 }}>{step.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tarea {step.orden}
                  </Typography>
                </Box>
                <StatusBadge value={step.estado} />
              </Button>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function WorkflowRow({ workflow }: { workflow: WorkflowSummary }) {
  return (
    <Button
      component={RouterLink}
      to={`/workflows/${workflow.id}`}
      variant="outlined"
      color="inherit"
      sx={{ justifyContent: "space-between", textTransform: "none" }}
    >
      <Box sx={{ textAlign: "left" }}>
        <Typography sx={{ fontWeight: 700 }}>{workflow.objetivo_final?.trim() || `Flow ${workflow.id.slice(0, 8)}`}</Typography>
        <Typography variant="body2" color="text.secondary">
          Inicio: {formatDate(workflow.fecha_inicio)}
        </Typography>
      </Box>
      <StatusBadge value={workflow.estado} />
    </Button>
  );
}
