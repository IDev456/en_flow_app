import Chip from "@mui/material/Chip";

import type { Ambito } from "../types";
import { getAmbitoLabel } from "../utils";

type AmbitoChipProps = {
  ambito: Ambito;
};

export function AmbitoChip({ ambito }: AmbitoChipProps) {
  const color = ambito === "laboral" ? "primary" : ambito === "personal" ? "secondary" : "default";
  return (
    <Chip
      size="small"
      variant={ambito ? "filled" : "outlined"}
      color={color}
      label={getAmbitoLabel(ambito)}
      sx={{ height: 24, fontWeight: 500 }}
    />
  );
}
