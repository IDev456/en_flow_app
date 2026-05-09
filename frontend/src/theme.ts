import { alpha, createTheme } from "@mui/material/styles";

export type AppThemeMode = "dark" | "warmLight";

const fontStack = [
  "Inter",
  "Manrope",
  "Nunito Sans",
  "Segoe UI",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
].join(",");

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  const palette = {
    mode: (isDark ? "dark" : "light") as "dark" | "light",
    primary: isDark
      ? {
          main: "#60a5fa",
          light: "#93c5fd",
          dark: "#2563eb",
          contrastText: "#0b1220",
        }
      : {
          main: "#1976d2",
          light: "#42a5f5",
          dark: "#115293",
          contrastText: "#ffffff",
        },
    secondary: isDark
      ? {
          main: "#a78bfa",
          light: "#c4b5fd",
          dark: "#7c3aed",
          contrastText: "#120b24",
        }
      : {
          main: "#7c4dff",
          light: "#9575cd",
          dark: "#5e35b1",
          contrastText: "#ffffff",
        },
    success: {
      main: isDark ? "#34d399" : "#2e7d32",
    },
    warning: {
      main: isDark ? "#fbbf24" : "#ed6c02",
    },
    error: {
      main: isDark ? "#f87171" : "#d32f2f",
    },
    info: {
      main: isDark ? "#38bdf8" : "#0288d1",
    },
    background: {
      default: isDark ? "#0f172a" : "#f4f6fb",
      paper: isDark ? "#111c33" : "#ffffff",
    },
    divider: isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(15, 23, 42, 0.12)",
    text: {
      primary: isDark ? "#e2e8f0" : "#1e293b",
      secondary: isDark ? "#94a3b8" : "#64748b",
    },
  };

  return createTheme({
    palette,
    shape: {
      borderRadius: 12,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: {
        fontSize: "2.25rem",
        fontWeight: 700,
        letterSpacing: "-0.04em",
      },
      h2: {
        fontSize: "1.9rem",
        fontWeight: 700,
        letterSpacing: "-0.03em",
      },
      h3: {
        fontSize: "1.35rem",
        fontWeight: 700,
        letterSpacing: "-0.015em",
      },
      h4: {
        fontSize: "1.1rem",
        fontWeight: 700,
      },
      h5: {
        fontSize: "1rem",
        fontWeight: 700,
      },
      h6: {
        fontSize: "0.95rem",
        fontWeight: 700,
      },
      subtitle1: {
        fontSize: "0.95rem",
        lineHeight: 1.55,
      },
      subtitle2: {
        fontSize: "0.76rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
      },
      body1: {
        lineHeight: 1.58,
      },
      body2: {
        lineHeight: 1.52,
      },
      button: {
        textTransform: "none",
        fontWeight: 700,
        letterSpacing: "0.01em",
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (themeParam) => ({
          html: {
            minHeight: "100%",
          },
          body: {
            minHeight: "100%",
            backgroundColor: themeParam.palette.background.default,
            backgroundImage: isDark
              ? [
                  `radial-gradient(circle at 8% 2%, ${alpha(themeParam.palette.primary.main, 0.18)}, transparent 32%)`,
                  `radial-gradient(circle at 92% 4%, ${alpha(themeParam.palette.secondary.main, 0.13)}, transparent 30%)`,
                  "linear-gradient(180deg, #0b1328 0%, #0f172a 52%, #111b34 100%)",
                ].join(",")
              : [
                  `radial-gradient(circle at 10% 5%, ${alpha(themeParam.palette.primary.main, 0.12)}, transparent 34%)`,
                  `radial-gradient(circle at 92% 0%, ${alpha(themeParam.palette.secondary.main, 0.1)}, transparent 33%)`,
                  "linear-gradient(180deg, #f8faff 0%, #f4f6fb 56%, #eff3fa 100%)",
                ].join(","),
            backgroundAttachment: "fixed",
          },
          "#root": {
            minHeight: "100vh",
          },
          a: {
            color: "inherit",
            textDecoration: "none",
          },
          "*::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "*::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: isDark ? alpha(themeParam.palette.common.white, 0.2) : alpha(themeParam.palette.text.secondary, 0.35),
            borderRadius: 999,
          },
        }),
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            boxShadow: "none",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.9 : 0.95)}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.94),
            backdropFilter: "blur(10px)",
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.92 : 0.98),
            boxShadow: isDark ? "0 14px 30px rgba(2, 8, 23, 0.35)" : "0 8px 24px rgba(15, 23, 42, 0.08)",
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 38,
            borderRadius: 10,
            paddingInline: 14,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 10,
            backgroundColor: isDark ? alpha(theme.palette.background.default, 0.34) : alpha(theme.palette.background.default, 0.64),
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
              borderWidth: 1.5,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            fontWeight: 700,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.98),
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({
            color: theme.palette.text.secondary,
            fontWeight: 700,
            letterSpacing: "0.08em",
            fontSize: "0.72rem",
            textTransform: "uppercase",
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          }),
          body: ({ theme }) => ({
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          }),
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: 3,
            borderRadius: 10,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.56 : 0.9),
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: 0,
            borderRadius: 8,
            color: theme.palette.text.secondary,
            fontWeight: 600,
            paddingInline: 12,
            "&.Mui-selected": {
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14),
            },
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: "transparent",
            },
          },
        },
      },
    },
  });
}
