import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { Step } from "../types";
import { DEFAULT_ACTOR, formatDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

type WorkflowInspectorProps = {
  workflowId: string;
  step: Step | null;
  onComplete: (payload: {
    usuario: string;
    resultado: string | null;
    observaciones: string | null;
    comentario_final: string | null;
  }) => Promise<void>;
};

export function WorkflowInspector({ workflowId, step, onComplete }: WorkflowInspectorProps) {
  const [usuario, setUsuario] = useState(DEFAULT_ACTOR);
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [comentarioFinal, setComentarioFinal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [step?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) {
      return;
    }

    const userTrimmed = usuario.trim();
    if (!userTrimmed) {
      setError("El usuario operativo es obligatorio");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onComplete({
        usuario: userTrimmed,
        resultado: resultado.trim() || null,
        observaciones: observaciones.trim() || null,
        comentario_final: comentarioFinal.trim() || null,
      });
      setResultado("");
      setObservaciones("");
      setComentarioFinal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el paso");
    } finally {
      setSubmitting(false);
    }
  }

  if (!step) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Sin paso seleccionado</Typography>
            <Typography color="text.secondary">
              Selecciona un paso del flujo para ver sus propiedades y operar sobre el.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const canComplete = step.estado === "activo" || step.estado === "espera" || step.estado === "problema";

  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            {workflowId}
          </Typography>
          <Typography variant="h5">{step.nombre}</Typography>
          <Typography color="text.secondary">{step.descripcion ?? "Sin descripcion"}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <StatusBadge value={step.estado} />
            <Typography variant="body2" color="text.secondary">
              {step.tipo}
            </Typography>
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Asignado: {step.asignado_a ?? "Sin asignar"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inicio: {formatDate(step.fecha_inicio)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vencimiento: {formatDate(step.fecha_vencimiento)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resultado: {step.resultado ?? "Todavia sin resultado"}
          </Typography>
        </Stack>

        {canComplete ? (
          <Stack component="form" spacing={1.5} onSubmit={handleSubmit}>
            <TextField label="Usuario operativo" value={usuario} onChange={(event) => setUsuario(event.target.value)} required />
            <TextField
              label="Resultado"
              multiline
              minRows={3}
              value={resultado}
              onChange={(event) => setResultado(event.target.value)}
              placeholder="Que se obtuvo al finalizar este paso?"
            />
            <TextField
              label="Observaciones"
              multiline
              minRows={3}
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              placeholder="Detalles tecnicos o impedimentos encontrados durante la ejecucion..."
            />
            <TextField
              label="Comentario final"
              multiline
              minRows={3}
              value={comentarioFinal}
              onChange={(event) => setComentarioFinal(event.target.value)}
              placeholder="Nota de cierre para la bitacora general..."
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Completando..." : "Completar paso"}
            </Button>
          </Stack>
        ) : (
          <Alert severity="info">Este paso no esta listo para completarse desde la vista del workflow.</Alert>
        )}

        <Link component={RouterLink} to={`/steps/${step.id}`} underline="hover">
          Abrir detalle completo del paso
        </Link>
      </CardContent>
    </Card>
  );
}
