import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";

import type { DuplicateCandidate } from "../utils/duplicateDetection";
import { formatCalendarDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

type LiveDuplicateSuggestionsProps = {
  candidates: DuplicateCandidate[];
  checking: boolean;
  onOpenExisting: (workflowId: string) => void;
};

export function LiveDuplicateSuggestions({ candidates, checking, onOpenExisting }: LiveDuplicateSuggestionsProps) {
  if (!checking && candidates.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 1.75 },
        border: "1px solid",
        borderColor: "outlineVariant",
        borderRadius: "10px",
        backgroundColor: "surfaceContainerLowest",
      }}
    >
      <Stack spacing={1.25}>
        <Stack spacing={0.35}>
          <Typography variant="subtitle2" color="text.secondary">
            Posibles tareas existentes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revisá si alguna coincide antes de crear una nueva.
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
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: "outlineVariant",
              borderRadius: "10px",
              backgroundColor: "surfaceContainerLow",
            }}
          >
            <Stack spacing={0.85}>
              {candidate.requirementLabels.length > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.02em" }}>
                  Proyecto asociado: {candidate.requirementLabels.join(" · ")}
                </Typography>
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
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {candidate.taskName}
                </Typography>
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
