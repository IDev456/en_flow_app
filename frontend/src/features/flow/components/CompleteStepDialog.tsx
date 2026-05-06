import React, { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
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

import type { Step, StepCompleteInput, StepTransitionType, AttachmentInput } from "../types";
import { DEFAULT_ACTOR } from "../utils";

type CompleteStepDialogProps = {
  open: boolean;
  step: Step | null;
  onClose: () => void;
  onSubmit: (stepId: string, input: StepCompleteInput) => Promise<void>;
};

export function CompleteStepDialog({ open, step, onClose, onSubmit }: CompleteStepDialogProps) {
  const [transition, setTransition] = useState<StepTransitionType>(StepTransitionType.NEXT_TASK);
  const [resultado, setResultado] = useState("");
  const [comentario, setComentario] = useState("");
  const [observaciones, setObservaciones] = useState("");
  
  // Proxima tarea
  const [nextName, setNextName] = useState("");
  const [nextAssignee, setNextAssignee] = useState("");

  // Espera externa
  const [waitExpected, setWaitExpected] = useState("");
  const [waitReason, setWaitReason] = useState("");
  const [waitReference, setWaitReference] = useState("");

  // Cierre flow
  const [finishReason, setFinishReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTransition(StepTransitionType.NEXT_TASK);
      setResultado("");
      setComentario("");
      setObservaciones("");
      setNextName("");
      setNextAssignee("");
      setWaitExpected("");
      setWaitReason("");
      setWaitReference("");
      setFinishReason("");
      setError(null);
      setAdvancedOpen(false);
    }
  }, [open]);

  if (!step) return null;

  async function handleConfirm() {
    const resTrimmed = resultado.trim();
    if (resTrimmed.length < 3) {
      setError("Debes indicar el resultado de la tarea.");
      return;
    }

    if (transition === StepTransitionType.NEXT_TASK && !nextName.trim()) {
      setError("Debes indicar el nombre de la próxima tarea.");
      return;
    }

    if (transition === StepTransitionType.WAIT_EXTERNAL && !waitExpected.trim()) {
      setError("Debes indicar qué respuesta se está esperando.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: StepCompleteInput = {
        usuario: DEFAULT_ACTOR,
        resultado_cierre: resTrimmed,
        comentario: comentario.trim() || resTrimmed,
        observaciones: observaciones.trim() || null,
        transition_type: transition,
        attachments: [],
        next_task: transition === StepTransitionType.NEXT_TASK ? {
          nombre: nextName.trim(),
          descripcion: null,
          asignado_a: nextAssignee.trim() || null,
          fecha_vencimiento: null
        } : null,
        external_wait: transition === StepTransitionType.WAIT_EXTERNAL ? {
          que_se_espera: waitExpected.trim(),
          detalle: waitReason.trim() || null,
          referencia_externa: waitReference.trim() || null,
          origen: "manual",
          attachments: []
        } : null,
        finish_data: transition === StepTransitionType.FINISH_FLOW ? {
          resultado_final: resTrimmed,
          motivo_cierre: finishReason.trim() || null,
          attachments: []
        } : null
      };

      await onSubmit(step.id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la tarea");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Completar tarea: {step.nombre}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label="¿Cuál fue el resultado? *"
            multiline
            minRows={2}
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            disabled={submitting}
            autoFocus
            placeholder="Ej: Diagnóstico realizado, se requiere cambio de pieza."
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              ¿Qué sigue ahora?
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={transition}
              onChange={(_, val) => val && setTransition(val)}
              fullWidth
              size="small"
              disabled={submitting}
            >
              <ToggleButton value={StepTransitionType.NEXT_TASK}>Próxima tarea</ToggleButton>
              <ToggleButton value={StepTransitionType.WAIT_EXTERNAL}>Espera externa</ToggleButton>
              <ToggleButton value={StepTransitionType.FINISH_FLOW}>Finalizar flow</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {transition === StepTransitionType.NEXT_TASK && (
            <Stack spacing={2}>
              <TextField
                label="Nombre de la próxima tarea *"
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                disabled={submitting}
                size="small"
              />
              <TextField
                label="Asignar a (opcional)"
                value={nextAssignee}
                onChange={(e) => setNextAssignee(e.target.value)}
                disabled={submitting}
                size="small"
              />
            </Stack>
          )}

          {transition === StepTransitionType.WAIT_EXTERNAL && (
            <Stack spacing={2}>
              <TextField
                label="¿Qué respuesta esperamos? *"
                value={waitExpected}
                onChange={(e) => setWaitExpected(e.target.value)}
                disabled={submitting}
                size="small"
                placeholder="Ej: Aprobación de presupuesto"
              />
              <TextField
                label="Referencia / Ticket externo"
                value={waitReference}
                onChange={(e) => setWaitReference(e.target.value)}
                disabled={submitting}
                size="small"
              />
            </Stack>
          )}

          {transition === StepTransitionType.FINISH_FLOW && (
            <Alert severity="success">
              El flow se marcará como <strong>Finalizado</strong> y el requerimiento como <strong>Resuelto</strong>.
            </Alert>
          )}

          <Box>
            <Button 
              variant="text" 
              size="small" 
              onClick={() => setAdvancedOpen(!advancedOpen)}
              color="inherit"
            >
              {advancedOpen ? "Ocultar detalles" : "Agregar más detalles (notas, motivos)"}
            </Button>
            <Collapse in={advancedOpen}>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="Comentario adicional"
                  multiline
                  minRows={2}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  disabled={submitting}
                  size="small"
                />
                {transition === StepTransitionType.FINISH_FLOW && (
                  <TextField
                    label="Motivo de cierre"
                    value={finishReason}
                    onChange={(e) => setFinishReason(e.target.value)}
                    disabled={submitting}
                    size="small"
                  />
                )}
                <TextField
                  label="Observaciones técnicas (interno)"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  disabled={submitting}
                  size="small"
                />
              </Stack>
            </Collapse>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Cancelar
        </Button>
        <Button onClick={() => void handleConfirm()} variant="contained" disabled={submitting}>
          {submitting ? "Guardando..." : "Confirmar y continuar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}