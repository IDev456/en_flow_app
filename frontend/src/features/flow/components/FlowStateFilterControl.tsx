import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, ButtonBase, Paper, Typography } from "@mui/material";

import type { FlowCountSummary, FlowFilter } from "../utils/flowTable";

type FlowStateFilterControlVariant = "flows" | "projects";

type FlowStateFilterControlProps = {
  value: FlowFilter;
  counts: FlowCountSummary;
  onChange: (value: FlowFilter) => void;
  variant?: FlowStateFilterControlVariant;
};

export function FlowStateFilterControl({
  value,
  counts,
  onChange,
  variant = "flows",
}: FlowStateFilterControlProps) {
  const theme = useTheme();

  const options =
    variant === "projects"
      ? [
          {
            value: "operational" as const,
            label: "Operativos",
            token: theme.palette.status.active,
            count: counts.active + counts.waiting,
            icon: <BoltRoundedIcon sx={{ fontSize: 16 }} />,
          },
          {
            value: "non_operational" as const,
            label: "No operativos",
            token: theme.palette.status.cancelled,
            count: counts.cancelled + counts.finalized,
            icon: <CancelOutlinedIcon sx={{ fontSize: 16 }} />,
          },
        ]
      : [
          {
            value: "active" as const,
            label: "Activos",
            token: theme.palette.status.active,
            count: counts.active,
            icon: <BoltRoundedIcon sx={{ fontSize: 16 }} />,
          },
          {
            value: "waiting" as const,
            label: "Esperando",
            token: theme.palette.status.waiting,
            count: counts.waiting,
            icon: <HourglassTopRoundedIcon sx={{ fontSize: 16 }} />,
          },
          {
            value: "non_operational" as const,
            label: "No operativos",
            token: theme.palette.status.cancelled,
            count: counts.cancelled + counts.finalized,
            icon: <CancelOutlinedIcon sx={{ fontSize: 16 }} />,
          },
        ];

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", width: "100%" }}>
      <Box
        aria-label="Filtro de estado"
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option, index) => {
          const isSelected = value === option.value;

          return (
            <ButtonBase
              key={option.value}
              onClick={() => onChange(option.value)}
              sx={{
                minHeight: 64,
                px: 0.75,
                py: 0.5,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.35,
                borderRight: index < options.length - 1 ? "1px solid" : "none",
                borderColor: "divider",
                backgroundColor: isSelected ? option.token.container : "transparent",
                color: isSelected ? option.token.onContainer : "text.secondary",
                transition: "background-color 0.15s",
                "&:hover": {
                  backgroundColor: alpha(option.token.container, 0.6),
                },
                "& .MuiSvgIcon-root": {
                  color: isSelected ? option.token.accent : theme.palette.text.disabled,
                },
              }}
            >
              {option.icon}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: "0.68rem",
                  lineHeight: 1.2,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {option.label} ({option.count})
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Paper>
  );
}
