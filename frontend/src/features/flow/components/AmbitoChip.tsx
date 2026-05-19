import Chip from "@mui/material/Chip";

import type { Ambito } from "../types";
import { getAmbitoLabel } from "../utils";

type AmbitoChipProps = {
  ambito: Ambito;
};

export function AmbitoChip({ ambito }: AmbitoChipProps) {
  return (
    <Chip
      size="small"
      variant={ambito ? "filled" : "outlined"}
      label={getAmbitoLabel(ambito)}
      sx={(theme) => {
        const isLaboral = ambito === "laboral";
        const isPersonal = ambito === "personal";
        const bg = isLaboral
          ? theme.palette.primary.main
          : isPersonal
          ? theme.palette.secondary.main
          : theme.palette.surfaceContainerLowest;
        const colorText = (isLaboral || isPersonal)
          ? theme.palette.getContrastText(bg)
          : theme.palette.text.primary;
        return {
          height: 24,
          fontWeight: 500,
          borderRadius: theme.appShape.pill,
          bgcolor: bg,
          color: colorText,
          borderColor: theme.palette.outlineVariant,
        };
      }}
    />
  );
}
