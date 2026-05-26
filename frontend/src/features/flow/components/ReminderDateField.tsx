import type { ReactNode } from "react";
import { Box, Stack, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
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
  inputRef?: TextFieldProps["inputRef"];
  sx?: SxProps<Theme>;
  shortcutBaseDateInput?: string | null;
  compact?: boolean;
  showShortcuts?: boolean;
  shortcutVariant?: "chips" | "buttons";
  fullWidth?: boolean;
};

export function ReminderDateField({
  value,
  onChange,
  onShortcutSelect,
  label = "Recordatorio",
  helperText,
  disabled = false,
  error = false,
  minDate = getTodayLocalDateInput(),
  size,
  autoFocus = false,
  onBlur,
  onKeyDown,
  inputRef,
  sx,
  shortcutBaseDateInput = null,
  compact = false,
  showShortcuts = true,
  shortcutVariant = "chips",
  fullWidth = true,
}: ReminderDateFieldProps) {
  const resolvedHelperText =
    helperText !== undefined ? helperText : compact ? "Desde hoy" : "Elegí una fecha a partir de hoy.";
  const effectiveLabel = compact && !label ? undefined : label;

  return (
    <Box
      sx={[
        {
          width: fullWidth ? "100%" : "auto",
          minWidth: 0,
          borderRadius: (theme) => theme.appShape.md,
          border: compact ? "none" : "1px solid",
          borderColor: compact ? "transparent" : "outlineVariant",
          backgroundColor: compact ? "transparent" : "surfaceContainerLow",
          px: compact ? 0 : { xs: 1, sm: 1.15 },
          py: compact ? 0 : { xs: 0.85, sm: 1 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack spacing={compact ? 0.55 : 0.8}>
        <TextField
          label={effectiveLabel}
          type="date"
          value={value}
          size={size ?? (compact ? "small" : "medium")}
          autoFocus={autoFocus}
          inputRef={inputRef}
          fullWidth={fullWidth}
          disabled={disabled}
          error={error}
          helperText={resolvedHelperText}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            formHelperText: {
              sx: {
                mt: compact ? 0.35 : 0.45,
                mx: 0,
                lineHeight: 1.25,
              },
            },
            htmlInput: { min: minDate },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: (theme) => (compact ? theme.appShape.sm : theme.appShape.md),
              backgroundColor: compact ? "background.paper" : "surfaceContainerLowest",
            },
          }}
        />
        {showShortcuts ? (
          <ReminderShortcutButtons
            onSelect={onShortcutSelect ?? onChange}
            disabled={disabled}
            baseDateInput={shortcutBaseDateInput}
            currentValue={value}
            variant={shortcutVariant}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
