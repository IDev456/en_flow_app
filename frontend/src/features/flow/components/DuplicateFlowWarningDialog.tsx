import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

import type { DuplicateCandidate } from "../utils/duplicateDetection";
import { formatCalendarDate, formatElapsedTime } from "../utils";
import { StatusBadge } from "./StatusBadge";

type DuplicateFlowWarningDialogProps = {
  open: boolean;
  candidates: DuplicateCandidate[];
  busy?: boolean;
  onOpenExisting: (workflowId: string) => void;
  onOpenRequirement?: (requirementId: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
};

export function DuplicateFlowWarningDialog({
  open,
  candidates,
  busy = false,
  onOpenExisting,
  onOpenRequirement,
  onCreateAnyway,
  onCancel,
}: DuplicateFlowWarningDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
          <WarningAmberRoundedIcon color="warning" />
          <Stack spacing={0.35}>
            <Typography variant="h5">Encontre tareas parecidas</Typography>
            <Typography variant="body2" color="text.secondary">
              Ya existe una o mas tareas similares. Revisa si corresponde abrir una existente antes de crear una nueva.
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: "outlineVariant" }}>
        <Stack spacing={1.5}>
          {candidates.map((candidate) => (
            <Box
              key={candidate.workflowId}
              sx={(theme) => ({
                p: { xs: 1.5, md: 1.75 },
                border: "1px solid",
                borderColor: theme.palette.outlineVariant,
                borderRadius: theme.appShape.md,
                backgroundColor: theme.palette.surfaceContainerLowest,
              })}
            >
              <Stack spacing={1.1}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {candidate.taskName}
                  </Typography>
                  <StatusBadge value={candidate.displayStatus} />
                </Stack>

                {candidate.requirements.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">
                      Proyecto:
                    </Typography>
                    {candidate.requirements.map((requirement) => (
                      <Button
                        key={requirement.id}
                        size="small"
                        color="inherit"
                        onClick={() => onOpenRequirement?.(requirement.id)}
                        disabled={busy || !onOpenRequirement}
                        sx={{ px: 0.5, textTransform: "none" }}
                      >
                        {requirement.label}
                      </Button>
                    ))}
                  </Stack>
                )}

                {candidate.reminderAt && (
                  <Typography variant="body2" color="text.secondary">
                    Fecha / recordatorio: {formatCalendarDate(candidate.reminderAt)}
                  </Typography>
                )}

                {candidate.latestComment ? (
                  <Alert severity="info" sx={{ py: 0.4 }}>
                    Ultimo comentario: {candidate.latestComment}
                  </Alert>
                ) : candidate.latestMovementAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Ultimo movimiento: {formatElapsedTime(candidate.latestMovementAt) ?? "sin actividad reciente"}
                  </Typography>
                ) : null}

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Coincidencia estimada: {Math.round(candidate.score * 100)}%
                  </Typography>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<LaunchRoundedIcon />}
                    onClick={() => onOpenExisting(candidate.workflowId)}
                    disabled={busy}
                  >
                    Abrir existente
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, justifyContent: "space-between", gap: 1.25, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          Podes seguir igual si confirmas que se trata de una tarea nueva.
        </Typography>
        <Stack direction="row" spacing={1.25}>
          <Button onClick={onCancel} color="inherit" disabled={busy}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={onCreateAnyway} disabled={busy}>
            Crear de todos modos
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
