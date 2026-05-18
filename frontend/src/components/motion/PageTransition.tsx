import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { useReducedMotionPreference } from "./useReducedMotionPreference";

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotionPreference();
  const duration = prefersReducedMotion ? 0 : theme.appMotion.medium;
  const offsetY = prefersReducedMotion ? 0 : theme.appMotion.pageOffsetY;

  return (
    <Box
      className={prefersReducedMotion ? "page-transition-root page-transition-root--reduced" : "page-transition-root"}
      sx={{
        minWidth: 0,
        "--page-transition-duration": `${duration}ms`,
        "--page-transition-easing": theme.transitions.easing.easeInOut,
        "--page-transition-offset-y": `${offsetY}px`,
      }}
    >
      {children}
    </Box>
  );
}
