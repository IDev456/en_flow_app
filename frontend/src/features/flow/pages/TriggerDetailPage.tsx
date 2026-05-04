import { useEffect, useState } from "react";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import SchemaRoundedIcon from "@mui/icons-material/SchemaRounded";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import { getTrigger, startWorkflow } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import type { TriggerDetail } from "../types";
import { DEFAULT_ACTOR, formatDate } from "../utils";

export function TriggerDetailPage() {
  const { triggerId = "" } = useParams();
  const [trigger, setTrigger] = useState<TriggerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newWorkflowFirstDescription, setNewWorkflowFirstDescription] = useState("");
  const [newWorkflowError, setNewWorkflowError] = useState<string | null>(null);
  const [newWorkflowSuccess, setNewWorkflowSuccess] = useState<string | null>(null);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const navigate = useNavigate();

  function getPrimaryDetail(currentTrigger: TriggerDetail) {
    return currentTrigger.descripcion?.trim() || "Requerimiento sin detalle";
  }

  function getSecondaryRequester(currentTrigger: TriggerDetail) {
    return currentTrigger.solicitante?.trim() || "Sin solicitante";
  }

  useEffect(() => {
    void loadTrigger();
  }, [triggerId]);

  async function loadTrigger() {
    try {
      setLoading(true);
      setError(null);
      setNewWorkflowError(null);
      setTrigger(await getTrigger(triggerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el disparador");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWorkflow() {
    if (!trigger) return;

    if (!newWorkflowFirstDescription.trim()) {
      setNewWorkflowError("Debes indicar la descripcion del primer paso.");
      return;
    }

    try {
      setCreatingWorkflow(true);
      setNewWorkflowError(null);
      setNewWorkflowSuccess(null);
      const newWorkflow = await startWorkflow(trigger.id, {
        objetivo_final: trigger.descripcion ?? "Gestionar requerimiento",
        resolucion_esperada: "Flujo completado con validacion final",
        primer_paso: {
          nombre: "Paso inicial",
          descripcion: newWorkflowFirstDescription.trim(),
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null,
        },
      });
      setNewWorkflowSuccess("Nuevo workflow asociado creado.");
      setNewWorkflowFirstDescription("");
      await loadTrigger();
      navigate(`/workflows/${newWorkflow.id}`);
    } catch (err) {
      setNewWorkflowError(err instanceof Error ? err.message : "No se pudo crear el nuevo workflow");
    } finally {
      setCreatingWorkflow(false);
    }
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ py: 8, alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Cargando requerimiento...</Typography>
      </Stack>
    );
  }

  if (error && !trigger) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!trigger) {
    return <Alert severity="info">Requerimiento no encontrado.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} underline="hover" color="inherit" to="/triggers">
          Requerimientos
        </Link>
        <Typography color="text.primary">{getPrimaryDetail(trigger)}</Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.1fr) minmax(320px, 0.9fr)" },
        }}
      >
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="subtitle2" color="primary.light">
                    Disparador
                  </Typography>
                  <Typography variant="h3">{getPrimaryDetail(trigger)}</Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Solicitante: {getSecondaryRequester(trigger)}
                  </Typography>
                </Box>
                <StatusBadge value={trigger.estado_general} />
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                <InfoItem label="Tipo" value={trigger.tipo} />
                <InfoItem label="Registrado por" value={trigger.creado_por} />
                <InfoItem label="Creado" value={formatDate(trigger.fecha_creacion)} />
                <InfoItem label="Actualizado" value={formatDate(trigger.fecha_actualizacion)} />
              </Box>

              {trigger.metadata && (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    overflow: "auto",
                    borderRadius: 3,
                    backgroundColor: "rgba(7, 11, 20, 0.75)",
                    border: "1px solid",
                    borderColor: "divider",
                    fontSize: 13,
                  }}
                >
                  {JSON.stringify(trigger.metadata, null, 2)}
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="h5">Workflows asociados</Typography>
                <Typography variant="body2" color="text.secondary">
                  Inicia un workflow o crea uno paralelo sobre este mismo disparador.
                </Typography>
              </Stack>

              {trigger.workflow_activo_id ? (
                <Stack spacing={2}>
                  <Alert severity="info">Hay al menos un workflow activo asociado a este requerimiento.</Alert>
                  <Button
                    component={RouterLink}
                    to={`/workflows/${trigger.workflow_activo_id}`}
                    variant="contained"
                    startIcon={<SchemaRoundedIcon />}
                  >
                    Abrir workflow
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Typography color="text.secondary">No hay workflow activo en este momento.</Typography>
                </Stack>
              )}

              <Stack spacing={1.25}>
                <Typography variant="subtitle2" color="text.secondary">
                  Crear nuevo workflow asociado
                </Typography>
                <TextField
                  label="Descripcion del primer paso *"
                  multiline
                  minRows={3}
                  value={newWorkflowFirstDescription}
                  onChange={(event) => setNewWorkflowFirstDescription(event.target.value)}
                  disabled={creatingWorkflow}
                />
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<PlayCircleOutlineRoundedIcon />}
                  onClick={() => void handleCreateWorkflow()}
                  disabled={creatingWorkflow}
                >
                  {creatingWorkflow ? "Creando workflow..." : "Crear nuevo workflow"}
                </Button>
                {newWorkflowError && <Alert severity="error">{newWorkflowError}</Alert>}
                {newWorkflowSuccess && <Alert severity="success">{newWorkflowSuccess}</Alert>}
              </Stack>

              {trigger.workflow_ids.length > 0 && (
                <Stack spacing={1.25}>
                  <Typography variant="h6">Historial de workflows</Typography>
                  <Stack spacing={1}>
                    {trigger.workflow_ids.map((workflowId, index) => (
                      <Button
                        key={workflowId}
                        component={RouterLink}
                        to={`/workflows/${workflowId}`}
                        variant="outlined"
                        color="inherit"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <span>Workflow {index + 1}</span>
                        <span>{workflowId.slice(0, 8)}</span>
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

type InfoItemProps = {
  label: string;
  value: string;
};

function InfoItem({ label, value }: InfoItemProps) {
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
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}
