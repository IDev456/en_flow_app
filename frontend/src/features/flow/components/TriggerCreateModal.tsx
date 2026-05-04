import { useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { createTrigger, startWorkflow } from "../api";
import { DEFAULT_ACTOR } from "../utils";

type TriggerCreateModalProps = {
  onClose: () => void;
};

const SOLICITANTE_MAX = 150;
const TRIGGER_DESCRIPTION_MAX = 1000;
const STEP_DESCRIPTION_MAX = 1000;
const OBJETIVO_FINAL_MAX = 200;

export function TriggerCreateModal({ onClose }: TriggerCreateModalProps) {
  const [solicitante, setSolicitante] = useState("");
  const [description, setDescription] = useState("");
  const [firstDescription, setFirstDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const canSubmit = firstDescription.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Debes definir la descripcion del primer paso");
      return;
    }

    if (solicitante.trim().length > SOLICITANTE_MAX) {
      setError(`Solicitante supera ${SOLICITANTE_MAX} caracteres`);
      return;
    }

    if (description.trim().length > TRIGGER_DESCRIPTION_MAX) {
      setError(`Descripcion supera ${TRIGGER_DESCRIPTION_MAX} caracteres`);
      return;
    }

    if (firstDescription.trim().length > STEP_DESCRIPTION_MAX) {
      setError(`Descripcion del paso supera ${STEP_DESCRIPTION_MAX} caracteres`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const descriptionText = description.trim();
      const objetivoFinal = descriptionText
        ? descriptionText.slice(0, OBJETIVO_FINAL_MAX)
        : "Gestionar requerimiento";

      const trigger = await createTrigger({
        solicitante: solicitante.trim() || null,
        descripcion: descriptionText || null,
        tipo: "requerimiento",
        metadata: null,
      });

      const workflow = await startWorkflow(trigger.id, {
        objetivo_final: objetivoFinal,
        resolucion_esperada: "Workflow resuelto y validado",
        primer_paso: {
          nombre: "Paso inicial",
          descripcion: firstDescription.trim() || null,
          asignado_a: DEFAULT_ACTOR,
          fecha_vencimiento: null,
        },
      });

      onClose();
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el requerimiento");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="primary.light">
            Nuevo requerimiento
          </Typography>
          <Typography variant="h4">Iniciar un flujo</Typography>
          <Typography variant="body2" color="text.secondary">
            Define el primer paso para arrancar. Solicitante y descripcion son opcionales.
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: "divider" }}>
        <Stack spacing={3}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <TextField
              autoFocus
              label="Solicitante"
              value={solicitante}
              onChange={(event) => setSolicitante(event.target.value.slice(0, SOLICITANTE_MAX))}
              placeholder="Ej. Cliente A, Sector Operaciones, Juan Perez..."
            />
            <TextField
              label="Descripcion"
              multiline
              minRows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, TRIGGER_DESCRIPTION_MAX))}
              placeholder="De que se trata este requerimiento?"
            />
          </Box>

          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "rgba(12, 18, 31, 0.58)",
            }}
          >
            <Stack spacing={2}>
              <Stack spacing={0.75}>
                <Typography variant="h6">Primer paso</Typography>
                <Typography variant="body2" color="text.secondary">
                  Todo flujo arranca con un paso. Describe que hay que hacer para comenzar.
                </Typography>
              </Stack>

              <TextField
                label="Descripcion del paso *"
                multiline
                minRows={4}
                value={firstDescription}
                onChange={(event) => setFirstDescription(event.target.value.slice(0, STEP_DESCRIPTION_MAX))}
                placeholder="Ej. Preguntarle a Orlando quien es Orlando."
              />
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Se creara el trigger y el workflow inicial en una sola accion.
        </Typography>
        <Stack direction="row" spacing={1.25}>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={submitting || !canSubmit}
            startIcon={<AddTaskRoundedIcon />}
          >
            {submitting ? "Creando..." : "Crear requerimiento"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
