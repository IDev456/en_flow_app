import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { listActiveWorkflows, listPendingSteps } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { Step, WorkflowSummary } from "../types";
import { formatDate } from "../utils";

export function DashboardPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);
      const [workflowData, stepData] = await Promise.all([listActiveWorkflows(), listPendingSteps()]);
      setWorkflows(workflowData);
      setSteps(stepData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="primary.light">
                Vista operativa
              </Typography>
              <Typography variant="h2">Workflows activos y pasos abiertos</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Deteccion rapida de que flujo necesita atencion y en que estado esta cada paso.
              </Typography>
            </Box>

            {loading && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <CircularProgress size={22} />
                <Typography color="text.secondary">Cargando informacion...</Typography>
              </Stack>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                <MetricCard label="Workflows activos" value={workflows.length} />
                <MetricCard label="Pasos abiertos" value={steps.length} />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!loading && !error && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
          }}
        >
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack spacing={2}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="h5">Workflows activos</Typography>
                  <Button component={RouterLink} to="/triggers" variant="text" color="inherit">
                    Ver todos
                  </Button>
                </Stack>
                {workflows.length === 0 ? (
                  <Alert severity="info">Todavia no hay workflows activos.</Alert>
                ) : (
                  workflows.map((workflow) => (
                    <Card key={workflow.id} variant="outlined">
                      <CardContent sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{workflow.workflow_template_nombre}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Paso actual: {workflow.paso_actual ?? "sin paso activo"}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <StatusBadge value={workflow.estado} />
                          <Button component={RouterLink} to={`/workflows/${workflow.id}`} variant="outlined" color="inherit">
                            Abrir
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Stack spacing={2}>
                <Typography variant="h5">Pasos abiertos</Typography>
                {steps.length === 0 ? (
                  <Alert severity="info">No hay pasos abiertos.</Alert>
                ) : (
                  steps.map((step) => (
                    <Card key={step.id} variant="outlined">
                      <CardContent sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            Paso {step.orden}: {step.nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {step.asignado_a ?? "Sin asignar"} | {formatDate(step.fecha_vencimiento)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <StatusBadge value={step.estado} />
                          <Button component={RouterLink} to={`/steps/${step.id}`} variant="outlined" color="inherit">
                            Revisar
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Stack>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "rgba(12, 18, 31, 0.62)",
      }}
    >
      <Typography variant="h4">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
