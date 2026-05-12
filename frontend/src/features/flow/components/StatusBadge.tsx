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
      color: isDark ? theme.palette.info.light : theme.palette.info.dark,
      bgcolor: alpha(theme.palette.info.main, isDark ? 0.18 : 0.12),
      borderColor: alpha(theme.palette.info.main, isDark ? 0.42 : 0.32),
      "&::before": {
        content: '""',
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: "currentColor",
        marginRight: 4,
        animation: "pulse 1.8s ease-in-out infinite",
      },
    };
  } else if (tone === "espera_externa") {
    color = "warning";
    sx = {
      color: isDark ? theme.palette.warning.light : theme.palette.warning.dark,
      bgcolor: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.12),
      borderColor: alpha(theme.palette.warning.main, isDark ? 0.42 : 0.32),
    };
  } else if (tone === "finalizado" || tone === "completado" || tone === "resuelto") {
    color = "success";
    sx = {
      color: isDark ? theme.palette.success.light : theme.palette.success.dark,
      bgcolor: alpha(theme.palette.success.main, isDark ? 0.18 : 0.12),
      borderColor: alpha(theme.palette.success.main, isDark ? 0.42 : 0.3),
    };
  } else if (tone === "espera") {
    color = "warning";
    sx = {
      color: isDark ? theme.palette.warning.light : theme.palette.warning.dark,
      bgcolor: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
      borderColor: alpha(theme.palette.warning.main, isDark ? 0.45 : 0.32),
    };
  } else if (tone === "problema") {
    color = "error";
    sx = {
      color: isDark ? theme.palette.error.light : theme.palette.error.dark,
      bgcolor: alpha(theme.palette.error.main, isDark ? 0.17 : 0.1),
      borderColor: alpha(theme.palette.error.main, isDark ? 0.4 : 0.28),
    };
  } else if (tone === "cancelado") {
    color = "default";
    sx = {
      color: theme.palette.text.secondary,
      bgcolor: alpha(theme.palette.grey[500], isDark ? 0.2 : 0.09),
      borderColor: alpha(theme.palette.grey[500], isDark ? 0.35 : 0.24),
    };
  } else if (tone === "error") {
    color = "error";
    sx = {
      color: isDark ? theme.palette.error.light : theme.palette.error.dark,
      bgcolor: alpha(theme.palette.error.main, isDark ? 0.16 : 0.1),
      borderColor: alpha(theme.palette.error.main, isDark ? 0.35 : 0.24),
    };
  }

  return (
    <Chip
      label={humanizeStatus(value)}
      color={color}
      size="small"
      variant={color === "default" ? "outlined" : "filled"}
      sx={{
        borderRadius: 1.2,
        fontWeight: 700,
        borderWidth: 1,
        maxWidth: "100%",
        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
        ...sx,
      }}
    />
  );
}
