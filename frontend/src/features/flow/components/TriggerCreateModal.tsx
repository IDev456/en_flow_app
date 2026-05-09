import { useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
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
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { quickCaptureFlow } from "../api";
import { DEFAULT_ACTOR } from "../utils";

type TriggerCreateModalProps = {
  onClose: () => void;
};

export function TriggerCreateModal({ onClose }: TriggerCreateModalProps) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const canSubmit = title.trim().length >= 3;

  function handleClose() {
    if (title.trim() || detail.trim() || assignee.trim() || dueDate) {
      if (!window.confirm("¿Cerrar sin guardar? Se perderán los datos ingresados.")) {
        return;
      }
    }
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Escribe la tarea principal para capturar el flow.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const workflow = await quickCaptureFlow({
        titulo: title.trim(),
        detalle: detail.trim() || null,
        asignado_a: assignee.trim() || DEFAULT_ACTOR,
        fecha_vencimiento: dueDate || null,
        creado_por: DEFAULT_ACTOR,
      });
      showToast("Tarea capturada.", "success");
      onClose();
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo capturar la tarea");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={submitting ? undefined : () => handleClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Captura rápida
          </Typography>
          <Typography variant="h4">Capturar tarea</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: "divider" }}>
        <Stack spacing={2.5}>
          <TextField
            autoFocus
            label="¿Qué tenés que hacer? *"
            multiline
            minRows={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej. Pedir layout actualizado al proveedor"
          />

          <Button variant="text" color="inherit" onClick={() => setShowOptional((current) => !current)} sx={{ alignSelf: "flex-start", px: 0.5 }}>
            <TuneRoundedIcon sx={{ fontSize: 16, mr: 0.6 }} />
            {showOptional ? "Ocultar datos opcionales" : "Agregar datos opcionales"}
          </Button>

          <Collapse in={showOptional}>
            <Box
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: (theme) =>
                  alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.34 : 0.82),
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  Datos opcionales
                </Typography>
                <TextField
                  label="Detalle"
                  multiline
                  minRows={2}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                />
                <TextField label="Asignado a" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
                <TextField
                  label="Fecha"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
            </Box>
          </Collapse>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Se crea un flow con una tarea activa inicial.
        </Typography>
        <Stack direction="row" spacing={1.25}>
          <Button variant="text" color="inherit" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit}
            startIcon={<AddTaskRoundedIcon />}
          >
            {submitting ? "Guardando..." : "Capturar tarea"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
