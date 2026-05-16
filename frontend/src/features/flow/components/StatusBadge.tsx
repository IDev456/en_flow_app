import { Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { getStatusSemanticKey, getStatusToken } from "../../../theme";
import { getStatusTone, humanizeStatus } from "../utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const theme = useTheme();
  const tone = getStatusTone(value);
  const semantic = getStatusSemanticKey(tone);
  const token = getStatusToken(theme, tone);
  const showDot = semantic === "active" || semantic === "waiting" || semantic === "problem";

  return (
    <Chip
      label={humanizeStatus(value)}
      size="small"
      variant="filled"
      sx={{
        maxWidth: "100%",
        height: 28,
        borderRadius: 999,
        fontWeight: 700,
        color: token.onContainer,
        bgcolor: token.container,
        border: `1px solid ${token.border}`,
        boxShadow: semantic === "active" ? `inset 0 0 0 1px ${token.border}` : "none",
        transition: theme.transitions.create(["background-color", "color", "border-color", "box-shadow"], {
          duration: theme.appMotion.short,
        }),
        "& .MuiChip-label": {
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "inline-flex",
          alignItems: "center",
          gap: showDot ? 0.75 : 0,
          px: 1.1,
        },
        ...(showDot
          ? {
              "& .MuiChip-label::before": {
                content: '""',
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: token.accent,
                boxShadow: semantic === "active" ? `0 0 0 3px ${token.soft}` : "none",
              },
            }
          : {}),
      }}
    />
  );
}
