import { alpha, useTheme } from "@mui/material/styles";
import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";

import { getStatusTone, humanizeStatus } from "../utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const tone = getStatusTone(value);

  let color: ChipProps["color"] = "default";
  let sx: ChipProps["sx"] | undefined;

  if (tone === "en_proceso" || tone === "activo") {
    color = "info";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.info.dark,
      bgcolor: alpha(theme.palette.info.main, isDark ? 0.9 : 0.22),
      borderColor: alpha(theme.palette.info.main, isDark ? 0.95 : 0.4),
    };
  } else if (tone === "espera_externa") {
    color = "info";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.info.dark,
      bgcolor: alpha(theme.palette.info.main, isDark ? 0.8 : 0.17),
      borderColor: alpha(theme.palette.info.main, isDark ? 0.9 : 0.34),
    };
  } else if (tone === "finalizado" || tone === "completado" || tone === "resuelto") {
    color = "success";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.success.dark,
      bgcolor: alpha(theme.palette.success.main, isDark ? 0.84 : 0.18),
      borderColor: alpha(theme.palette.success.main, isDark ? 0.94 : 0.34),
    };
  } else if (tone === "espera") {
    color = "warning";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.warning.dark,
      bgcolor: alpha(theme.palette.warning.main, isDark ? 0.9 : 0.19),
      borderColor: alpha(theme.palette.warning.main, isDark ? 0.94 : 0.38),
    };
  } else if (tone === "problema") {
    color = "error";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.error.dark,
      bgcolor: alpha(theme.palette.error.main, isDark ? 0.84 : 0.16),
      borderColor: alpha(theme.palette.error.main, isDark ? 0.92 : 0.34),
    };
  } else if (tone === "cancelado" || tone === "error") {
    color = "error";
    sx = {
      color: isDark ? theme.palette.grey[900] : theme.palette.error.dark,
      bgcolor: alpha(theme.palette.error.main, isDark ? 0.74 : 0.13),
      borderColor: alpha(theme.palette.error.main, isDark ? 0.84 : 0.3),
    };
  }

  return (
    <Chip
      label={humanizeStatus(value)}
      color={color}
      size="small"
      variant={color === "default" ? "outlined" : "filled"}
      sx={{ borderRadius: 1.2, fontWeight: 700, ...sx }}
    />
  );
}
