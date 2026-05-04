import { alpha } from "@mui/material/styles";
import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";

import { getStatusTone, humanizeStatus } from "../utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const tone = getStatusTone(value);

  let color: ChipProps["color"] = "default";
  let sx: ChipProps["sx"] | undefined;

  if (tone === "en_proceso" || tone === "activo") {
    color = "info";
    sx = {
      color: "#072133",
      bgcolor: alpha("#5fd1ff", 0.92),
      borderColor: alpha("#5fd1ff", 0.95),
    };
  } else if (tone === "finalizado" || tone === "completado" || tone === "resuelto") {
    color = "success";
    sx = {
      color: "#042514",
      bgcolor: alpha("#53d88f", 0.9),
      borderColor: alpha("#53d88f", 0.95),
    };
  } else if (tone === "espera" || tone === "problema") {
    color = "warning";
    sx = {
      color: "#2f1d06",
      bgcolor: alpha("#ffbe55", 0.95),
      borderColor: alpha("#ffbe55", 0.95),
    };
  } else if (tone === "cancelado" || tone === "error") {
    color = "error";
    sx = {
      color: "#2a0812",
      bgcolor: alpha("#ff6b8d", 0.92),
      borderColor: alpha("#ff6b8d", 0.95),
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
