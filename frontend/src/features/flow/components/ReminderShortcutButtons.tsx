import { Button, Chip, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { getRelativeCalendarDateInput } from "../utils";

type ReminderShortcutButtonsProps = {
  onSelect: (value: string) => void;
  disabled?: boolean;
  baseDateInput?: string | null;
  currentValue?: string | null;
  variant?: "chips" | "buttons";
};

export function ReminderShortcutButtons({
  onSelect,
  disabled = false,
  baseDateInput = null,
  currentValue = null,
  variant = "chips",
}: ReminderShortcutButtonsProps) {
  const theme = useTheme();
  const shortcuts = [
    { label: "Mañana", value: getRelativeCalendarDateInput(1, baseDateInput) },
    { label: "Pasado mañana", value: getRelativeCalendarDateInput(2, baseDateInput) },
  ] as const;

  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
      {shortcuts.map((shortcut) => {
        const selected = currentValue === shortcut.value;

        if (variant === "buttons") {
          return (
            <Button
              key={shortcut.label}
              type="button"
              size="small"
              variant="outlined"
              color="inherit"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => onSelect(shortcut.value)}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.35,
                textTransform: "none",
                borderRadius: theme.appShape.sm,
                borderColor: selected ? "text.secondary" : "outlineVariant",
                backgroundColor: selected ? alpha(theme.palette.text.primary, 0.06) : "transparent",
                color: selected ? "text.primary" : "text.secondary",
                "&:hover": {
                  borderColor: "text.secondary",
                  backgroundColor: alpha(theme.palette.text.primary, 0.08),
                },
              }}
            >
              {shortcut.label}
            </Button>
          );
        }

        return (
          <Chip
            key={shortcut.label}
            label={shortcut.label}
            size="small"
            variant="outlined"
            clickable={!disabled}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => onSelect(shortcut.value)}
            sx={{
              borderRadius: theme.appShape.pill,
              borderColor: selected ? "text.secondary" : "outlineVariant",
              backgroundColor: selected ? alpha(theme.palette.text.primary, 0.06) : theme.palette.surfaceContainerLowest,
              color: selected ? "text.primary" : "text.secondary",
              height: 24,
              "& .MuiChip-label": {
                px: 1.1,
                fontWeight: 500,
              },
              "&:hover": {
                borderColor: "text.secondary",
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
              },
            }}
          />
        );
      })}
    </Stack>
  );
}
