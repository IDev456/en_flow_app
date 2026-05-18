import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

type DataGridEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function DataGridEmptyState({ icon, title, description, action }: DataGridEmptyStateProps) {
  return (
    <Box sx={{ height: "100%", display: "grid", placeItems: "center", px: 3 }}>
      <Stack spacing={1} className="animate-fade-up" sx={{ alignItems: "center", textAlign: "center", maxWidth: 360 }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {action}
      </Stack>
    </Box>
  );
}
