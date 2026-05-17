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

  return (
    <Box
      className={prefersReducedMotion ? "page-transition-root page-transition-root--reduced" : "page-transition-root"}
      sx={{
        minWidth: 0,
        animationDuration: prefersReducedMotion ? "0ms" : `${theme.appMotion.medium}ms`,
        animationTimingFunction: theme.transitions.easing.easeInOut,
      }}
    >
      {children}
    </Box>
  );
}
