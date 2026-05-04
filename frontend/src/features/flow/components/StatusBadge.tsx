import type { ChipProps } from "@mui/material";
import { Chip } from "@mui/material";

import { getStatusTone, humanizeStatus } from "../utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const tone = getStatusTone(value);

  let color: ChipProps["color"] = "default";
  if (tone === "en_proceso" || tone === "activo") {
    color = "info";
  } else if (tone === "finalizado" || tone === "completado" || tone === "resuelto") {
    color = "success";
  } else if (tone === "espera") {
    color = "warning";
  } else if (tone === "problema" || tone === "cancelado" || tone === "error") {
    color = "error";
  } else if (tone === "nuevo") {
    color = "primary";
  }

  return <Chip label={humanizeStatus(value)} color={color} size="small" variant={color === "default" ? "outlined" : "filled"} />;
}
