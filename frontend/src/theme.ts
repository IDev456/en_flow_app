import { alpha, createTheme } from "@mui/material/styles";

export type AppThemeMode = "dark" | "warmLight";

const fontStack = [
  "Inter",
  "Public Sans",
  "Manrope",
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
          main: "#7c8da6",
          light: "#a0adbf",
          dark: "#5f6f87",
          contrastText: "#0b0e14",
        }
      : {
          main: "#4c5f7f",
          light: "#6d809f",
          dark: "#374763",
          contrastText: "#ffffff",
        },
    secondary: isDark
      ? {
          main: "#8b95a5",
          light: "#adb5c2",
          dark: "#697282",
          contrastText: "#0b0e14",
        }
      : {
          main: "#6b7280",
          light: "#8a91a0",
          dark: "#525866",
          contrastText: "#ffffff",
        },
    success: {
      main: isDark ? "#3eb489" : "#2e7d5a",
    },
    warning: {
      main: isDark ? "#d5a953" : "#c3891f",
    },
    error: {
      main: isDark ? "#d26b6b" : "#c64e4e",
    },
    info: {
      main: isDark ? "#5d8fcb" : "#3d77b8",
    },
    background: {
      default: isDark ? "#0a0c10" : "#f3f4f6",
      paper: isDark ? "#12151b" : "#ffffff",
    },
    divider: isDark ? "rgba(148, 155, 168, 0.2)" : "rgba(100, 116, 139, 0.2)",
    text: {
      primary: isDark ? "#e5e7eb" : "#111827",
      secondary: isDark ? "#9ca3af" : "#6b7280",
    },
  };

  return createTheme({
    palette,
    shape: {
      borderRadius: 10,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: {
        fontSize: "2.2rem",
        fontWeight: 700,
        letterSpacing: "-0.04em",
      },
      h2: {
        fontSize: "1.85rem",
        fontWeight: 700,
        letterSpacing: "-0.03em",
      },
      h3: {
        fontSize: "1.25rem",
        fontWeight: 700,
        letterSpacing: "-0.015em",
      },
      h4: {
        fontSize: "1.05rem",
        fontWeight: 700,
      },
      h5: {
        fontSize: "1rem",
        fontWeight: 700,
      },
      h6: {
        fontSize: "0.94rem",
        fontWeight: 700,
      },
      subtitle1: {
        fontSize: "0.94rem",
        lineHeight: 1.52,
      },
      subtitle2: {
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
      },
      body1: {
        lineHeight: 1.55,
      },
      body2: {
        lineHeight: 1.48,
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
                  `radial-gradient(circle at 10% 0%, ${alpha(themeParam.palette.common.white, 0.045)}, transparent 30%)`,
                  "linear-gradient(180deg, #07080b 0%, #0a0c10 48%, #0f1218 100%)",
                ].join(",")
              : [
                  `radial-gradient(circle at 2% -8%, ${alpha(themeParam.palette.primary.main, 0.08)}, transparent 34%)`,
                  "linear-gradient(180deg, #f8fafc 0%, #f3f4f6 56%, #eef0f4 100%)",
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
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.94 : 0.96),
            backdropFilter: "blur(8px)",
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
            borderRadius: 10,
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.95 : 0.99),
            boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.22)" : "0 4px 14px rgba(15, 23, 42, 0.07)",
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 36,
            borderRadius: 8,
            paddingInline: 14,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
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
            borderRadius: 8,
            backgroundColor: isDark ? alpha(theme.palette.background.default, 0.3) : alpha(theme.palette.background.default, 0.68),
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
              borderWidth: 1.4,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 700,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.97 : 0.99),
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
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
          }),
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: 3,
            borderRadius: 10,
            border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.52 : 0.95),
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
              color: theme.palette.text.primary,
              backgroundColor: alpha(theme.palette.common.white, isDark ? 0.09 : 0.82),
              border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
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
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            boxShadow: isDark ? "0 10px 26px rgba(0, 0, 0, 0.35)" : "0 8px 20px rgba(15, 23, 42, 0.1)",
          }),
        },
      },
    },
  });
}
