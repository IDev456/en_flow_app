import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { Step, StepStatus } from "../types";
import { stepStatusOptions } from "../utils";
import { StatusBadge } from "./StatusBadge";

type StatusChangeModalProps = {
  open: boolean;
  step: Step | null;
  targetStatus: StepStatus | null;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
};

export function StatusChangeModal({
  open,
  step,
  targetStatus,
  onCancel,
  onConfirm,
}: StatusChangeModalProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setSubmitting(false);
    }
  }, [open, targetStatus]);

  if (!open || !step || !targetStatus) {
    return null;
  }

  const option = stepStatusOptions.find((item) => item.value === targetStatus);
  const requiresNote = option?.requiresNote ?? false;
  const isValid = !requiresNote || note.trim().length >= 3;
  const charCount = note.trim().length;

  async function handleConfirm() {
    if (!isValid) return;
    try {
      setSubmitting(true);
      await onConfirm(note.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{targetStatus === "completado" ? "Completar paso" : "Cambiar estado"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.25 }}>
            <StatusBadge value={step.estado} />
            <Typography color="text.secondary">→</Typography>
            <StatusBadge value={targetStatus} />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            La nota queda registrada en la bitacora del paso.
          </Typography>

          <TextField
            autoFocus
            label={requiresNote ? "Nota del cambio *" : "Nota del cambio"}
            multiline
            minRows={4}
            placeholder={option?.placeholder ?? "Describe brevemente el motivo del cambio..."}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={requiresNote && charCount < 3}
            helperText={requiresNote ? `${charCount} / 3 caracteres minimo` : "Opcional"}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Ctrl + Enter para confirmar
        </Typography>
        <Stack direction="row" spacing={1.25}>
          <Button variant="text" color="inherit" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={!isValid || submitting}>
            {submitting ? "Guardando..." : targetStatus === "completado" ? "Completar paso" : "Confirmar"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
