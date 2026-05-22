import { Button, Stack } from "@mui/material";

import { getRelativeCalendarDateInput } from "../utils";

type ReminderShortcutButtonsProps = {
  onSelect: (value: string) => void;
  disabled?: boolean;
  baseDateInput?: string | null;
};

export function ReminderShortcutButtons({
  onSelect,
  disabled = false,
  baseDateInput = null,
}: ReminderShortcutButtonsProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
      <Button
        size="small"
        variant="text"
        color="inherit"
        disabled={disabled}
        onClick={() => onSelect(getRelativeCalendarDateInput(1, baseDateInput))}
        sx={{ px: 0.5, minWidth: 0, textTransform: "none" }}
      >
        Mañana
      </Button>
      <Button
        size="small"
        variant="text"
        color="inherit"
        disabled={disabled}
        onClick={() => onSelect(getRelativeCalendarDateInput(2, baseDateInput))}
        sx={{ px: 0.5, minWidth: 0, textTransform: "none" }}
      >
        Pasado mañana
      </Button>
    </Stack>
  );
}
