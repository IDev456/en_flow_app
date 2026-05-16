import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { useReducedMotionPreference } from "./useReducedMotionPreference";

type PageTransitionProps = {
  transitionKey: string;
  children: ReactNode;
};

export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotionPreference();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [prefersReducedMotion, transitionKey]);

  return (
    <Box
      className="page-transition-root"
      sx={{
        opacity: visible || prefersReducedMotion ? 1 : 0,
        transform: visible || prefersReducedMotion ? "translate3d(0, 0, 0)" : "translate3d(0, 10px, 0)",
        transition: theme.transitions.create(["opacity", "transform"], {
          duration: prefersReducedMotion ? 0 : theme.appMotion.medium,
          easing: theme.transitions.easing.easeOut,
        }),
      }}
    >
      {children}
    </Box>
  );
}
