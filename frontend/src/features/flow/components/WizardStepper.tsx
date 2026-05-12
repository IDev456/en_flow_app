import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box, Stack, Typography } from "@mui/material";

type WizardStepperProps = {
  current: number;
  items: string[];
};

export function WizardStepper({ current, items }: WizardStepperProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", md: "center" } }}>
      {items.map((item, index) => {
        const stepNumber = index + 1;
        const state = stepNumber < current ? "done" : stepNumber === current ? "active" : "idle";
        return (
          <Stack key={item} direction="row" spacing={1.25} sx={{ alignItems: "center", flex: 1 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                border: "1px solid",
                borderColor: state === "active" ? "primary.main" : state === "done" ? "success.main" : "divider",
                backgroundColor: state === "active" ? "primary.main" : state === "done" ? "success.main" : "transparent",
                color: state === "idle" ? "text.secondary" : "common.white",
                transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                flexShrink: 0,
              }}
            >
              {state === "done" ? <CheckRoundedIcon fontSize="small" /> : stepNumber}
            </Box>
            <Typography color={state === "idle" ? "text.secondary" : "text.primary"}>{item}</Typography>
            {index < items.length - 1 && (
              <Box sx={{ flex: 1, height: 1, borderRadius: 999, backgroundColor: "divider", display: { xs: "none", md: "block" } }} />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
