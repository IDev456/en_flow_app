import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";

import type { DuplicateCandidate } from "../utils/duplicateDetection";
import { formatCalendarDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

type LiveDuplicateSuggestionsProps = {
  candidates: DuplicateCandidate[];
  checking: boolean;
  onOpenExisting: (workflowId: string) => void;
  onOpenRequirement?: (requirementId: string) => void;
};

export function LiveDuplicateSuggestions({
  candidates,
  checking,
  onOpenExisting,
  onOpenRequirement,
}: LiveDuplicateSuggestionsProps) {
  if (!checking && candidates.length === 0) {
    return null;
  }

  return (
    <Box
      sx={(theme) => ({
        p: { xs: 1.5, md: 1.75 },
        border: "1px solid",
        borderColor: theme.palette.outlineVariant,
        borderRadius: theme.appShape.md,
        backgroundColor: theme.palette.surfaceContainerLowest,
      })}
    >
      <Stack spacing={1.25}>
        <Stack spacing={0.35}>
          <Typography variant="subtitle2" color="text.secondary">
            Posibles tareas existentes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revisa si alguna coincide antes de crear una nueva.
          </Typography>
        </Stack>

        {checking && candidates.length === 0 && (
          <Stack spacing={0.8}>
            <Typography variant="caption" color="text.secondary">
              Buscando coincidencias...
            </Typography>
            <LinearProgress />
          </Stack>
        )}

        {candidates.map((candidate) => (
          <Box
            key={candidate.workflowId}
            sx={(theme) => ({
              p: 1.25,
              border: "1px solid",
              borderColor: theme.palette.outlineVariant,
              borderRadius: theme.appShape.md,
              backgroundColor: theme.palette.surfaceContainerLow,
            })}
          >
            <Stack spacing={0.85}>
              {candidate.requirements.length > 0 ? (
                <Stack spacing={0.4}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.02em" }}>
                    Proyecto asociado:
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {candidate.requirements.map((requirement) => (
                      <Button
                        key={requirement.id}
                        size="small"
                        color="inherit"
                        onClick={() => onOpenRequirement?.(requirement.id)}
                        disabled={!onOpenRequirement}
                        sx={{ px: 0.5, alignSelf: "flex-start", textTransform: "none" }}
                      >
                        {requirement.label}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.02em" }}>
                  Proyecto asociado: Sin proyecto asociado
                </Typography>
              )}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
              >
                <Stack spacing={0.35}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {candidate.taskName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Coincidencia estimada: {Math.round(candidate.score * 100)}%
                  </Typography>
                </Stack>
                <StatusBadge value={candidate.displayStatus} />
              </Stack>

              {candidate.reminderAt && (
                <Typography variant="body2" color="text.secondary">
                  Recordatorio: {formatCalendarDate(candidate.reminderAt)}
                </Typography>
              )}

              <Box>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<LaunchRoundedIcon />}
                  onClick={() => onOpenExisting(candidate.workflowId)}
                >
                  Abrir
                </Button>
              </Box>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
