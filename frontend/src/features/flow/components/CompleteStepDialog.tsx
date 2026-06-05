import { useEffect, useState } from "react";
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

import { ReminderDateField } from "./ReminderDateField";
import type { Step, StepCompleteInput, StepTransitionType } from "../types";
import { DEFAULT_ACTOR, getReminderDateError, toCalendarDateUtcIso } from "../utils";

type CompleteStepDialogProps = {
  open: boolean;
  step: Step | null;
  onClose: () => void;
  onSubmit: (stepId: string, input: StepCompleteInput) => Promise<void>;
};

export function CompleteStepDialog({ open, step, onClose, onSubmit }: CompleteStepDialogProps) {
  const [transition, setTransition] = useState<StepTransitionType>("next_task");
  const [nextTaskName, setNextTaskName] = useState("");
  const [nextTaskReminderDate, setNextTaskReminderDate] = useState("");
  const [waitWhat, setWaitWhat] = useState("");
  const [waitFrom, setWaitFrom] = useState("");
  const [waitReference, setWaitReference] = useState("");
  const [waitDetail, setWaitDetail] = useState("");
  const [waitFollowUpDate, setWaitFollowUpDate] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWaitingExternal = step?.estado === "esperando_respuesta";

  useEffect(() => {
    if (open) {
      setTransition("next_task");
      setNextTaskName("");
      setNextTaskReminderDate("");
      setWaitWhat("");
      setWaitFrom("");
      setWaitReference("");
      setWaitDetail("");
      setWaitFollowUpDate("");
      setComment("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, step?.id]);

  if (!step) return null;

  async function handleConfirm() {
    const currentStep = step;
    if (!currentStep) {
      return;
    }

    if (transition === "next_task" && !nextTaskName.trim()) {
      setError("Debes indicar el nombre de la proxima tarea.");
      return;
    }

    if (transition === "wait_external" && !waitWhat.trim()) {
      setError("Debes indicar que estas esperando.");
      return;
    }

    if (transition === "next_task") {
      const reminderError = getReminderDateError(nextTaskReminderDate);
      if (reminderError) {
        setError(reminderError);
        return;
      }
    }

    if (transition === "wait_external") {
      const reminderError = getReminderDateError(waitFollowUpDate);
      if (reminderError) {
        setError(reminderError);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(currentStep.id, {
        usuario: DEFAULT_ACTOR,
        resultado_cierre: "Tarea completada",
        comentario: comment.trim() || null,
        observaciones: null,
        transition_type: transition,
        attachments: [],
        next_task:
          transition === "next_task"
            ? {
                nombre: nextTaskName.trim(),
                fecha_vencimiento: toCalendarDateUtcIso(nextTaskReminderDate),
              }
            : null,
        external_wait:
          transition === "wait_external"
            ? {
                que_se_espera: waitWhat.trim(),
                esperando_de: waitFrom.trim() || null,
                detalle: waitDetail.trim() || null,
                referencia_externa: waitReference.trim() || null,
                fecha_recordatorio: toCalendarDateUtcIso(waitFollowUpDate),
              }
            : null,
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
          <Typography variant="subtitle2" color="text.secondary">
            Que sigue?
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={transition}
            onChange={(_, value) => value && setTransition(value)}
            fullWidth
            disabled={submitting}
          >
            <ToggleButton value="next_task">Crear proxima tarea</ToggleButton>
            {!isWaitingExternal && <ToggleButton value="wait_external">Esperar respuesta externa</ToggleButton>}
            <ToggleButton value="finish_flow">Finalizar flow</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary">
            {transition === "next_task" && "Hay algo mas para hacer."}
            {transition === "wait_external" && "Queda pendiente una respuesta o dato externo."}
            {transition === "finish_flow" && "El tema ya quedo resuelto."}
          </Typography>

          {transition === "next_task" && (
            <Stack spacing={1.5}>
              <TextField
                label="Nombre de la proxima tarea *"
                value={nextTaskName}
                onChange={(event) => setNextTaskName(event.target.value)}
                disabled={submitting}
                autoFocus
              />
              <ReminderDateField
                value={nextTaskReminderDate}
                onChange={(value) => {
                  setNextTaskReminderDate(value);
                  if (error) setError(null);
                }}
                disabled={submitting}
                helperText="Recordatorio"
              />
            </Stack>
          )}

          {transition === "wait_external" && (
            <Stack spacing={1.5}>
              <TextField
                label="Que estas esperando? *"
                value={waitWhat}
                onChange={(event) => setWaitWhat(event.target.value)}
                disabled={submitting}
                autoFocus
              />
              <TextField
                label="De quien?"
                value={waitFrom}
                onChange={(event) => setWaitFrom(event.target.value)}
                disabled={submitting}
              />
              <TextField
                label="Referencia"
                value={waitReference}
                onChange={(event) => setWaitReference(event.target.value)}
                disabled={submitting}
              />
              <TextField
                label="Detalle"
                multiline
                minRows={2}
                value={waitDetail}
                onChange={(event) => setWaitDetail(event.target.value)}
                disabled={submitting}
              />
              <ReminderDateField
                value={waitFollowUpDate}
                onChange={(value) => {
                  setWaitFollowUpDate(value);
                  if (error) setError(null);
                }}
                disabled={submitting}
                helperText="Seguimiento opcional"
              />
            </Stack>
          )}

          <TextField
            label={isWaitingExternal ? "Respuesta / comentario (opcional)" : "Comentario (opcional)"}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            multiline
            minRows={2}
            disabled={submitting}
            fullWidth
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Cancelar
        </Button>
        <Button onClick={() => void handleConfirm()} disabled={submitting} variant="contained">
          {submitting ? "Guardando..." : "Guardar decision"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
