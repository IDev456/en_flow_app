import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { Stack, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material/TextField";

import { getTodayLocalDateInput } from "../utils";
import { ReminderShortcutButtons } from "./ReminderShortcutButtons";

type ReminderDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onShortcutSelect?: (value: string) => void;
  label?: string;
  helperText?: ReactNode;
  disabled?: boolean;
  error?: boolean;
  minDate?: string;
  size?: TextFieldProps["size"];
  autoFocus?: boolean;
  onBlur?: TextFieldProps["onBlur"];
  onKeyDown?: TextFieldProps["onKeyDown"];
  sx?: SxProps<Theme>;
  shortcutBaseDateInput?: string | null;
};

export function ReminderDateField({
  value,
  onChange,
  onShortcutSelect,
  label = "Recordatorio",
  helperText = "Fecha recordatorio",
  disabled = false,
  error = false,
  minDate = getTodayLocalDateInput(),
  size,
  autoFocus = false,
  onBlur,
  onKeyDown,
  sx,
  shortcutBaseDateInput = null,
}: ReminderDateFieldProps) {
  return (
    <Stack spacing={0.6} sx={sx}>
      <TextField
        label={label}
        type="date"
        value={value}
        size={size}
        autoFocus={autoFocus}
        disabled={disabled}
        error={error}
        helperText={helperText}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: minDate },
        }}
      />
      <ReminderShortcutButtons
        onSelect={onShortcutSelect ?? onChange}
        disabled={disabled}
        baseDateInput={shortcutBaseDateInput}
      />
    </Stack>
  );
}
