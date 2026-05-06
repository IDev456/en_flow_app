import { useState, useEffect } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import type { Step, StepCompleteInput, StepTransitionType } from "../types";
import { DEFAULT_ACTOR } from "../utils";

type CompleteStepDialogProps = {
  open: boolean;
  step: Step | null;
  onClose: () => void;
  onSubmit: (stepId: string, input: StepCompleteInput) => Promise<void>;
};

export function CompleteStepDialog({ open, step, onClose, onSubmit }: CompleteStepDialogProps) {
  const [transition, setTransition] = useState<StepTransitionType>("next_task");
  const [nextTaskName, setNextTaskName] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWaitingExternal = step?.estado === "esperando_respuesta";

  useEffect(() => {
    if (open) {
      setTransition("next_task");
      setNextTaskName("");
      setComment("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, step?.id]);

  if (!step) return null;

  async function handleConfirm() {
    if (transition === "next_task" && !nextTaskName.trim()) {
      setError("Debes indicar el nombre de la próxima tarea.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(step!.id, {
        usuario: DEFAULT_ACTOR,
        resultado_cierre: "Tarea completada",
        comentario: comment.trim() || null,
        observaciones: null,
        transition_type: transition,
        attachments: [],
        next_task: transition === "next_task" ? { nombre: nextTaskName.trim() } : null,
        external_wait: transition === "wait_external" ? { que_se_espera: "Esperando respuesta externa" } : null,
        finish_data: transition === "finish_flow" ? { resultado_final: "Flow finalizado" } : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Completar tarea</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="subtitle2" color="text.secondary">¿Qué sigue?</Typography>
          <ToggleButtonGroup
            exclusive
            value={transition}
            onChange={(_, v) => v && setTransition(v)}
            fullWidth
            disabled={submitting}
          >
            <ToggleButton value="next_task">Crear próxima tarea</ToggleButton>
            {!isWaitingExternal && <ToggleButton value="wait_external">Esperar respuesta externa</ToggleButton>}
            <ToggleButton value="finish_flow">Finalizar flow</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary">
            {transition === "next_task" && "Hay algo más para hacer."}
            {transition === "wait_external" && "Queda pendiente una respuesta o dato externo."}
            {transition === "finish_flow" && "El tema ya quedó resuelto."}
          </Typography>

          {transition === "next_task" && (
            <TextField
              label="Nombre de la próxima tarea *"
              value={nextTaskName}
              onChange={(e) => setNextTaskName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          )}

          <TextField
            label={isWaitingExternal ? "Respuesta / comentario (opcional)" : "Comentario (opcional)"}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            minRows={2}
            disabled={submitting}
            fullWidth
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">Cancelar</Button>
        <Button onClick={() => void handleConfirm()} disabled={submitting} variant="contained">
          {submitting ? "Guardando..." : "Guardar decisión"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}