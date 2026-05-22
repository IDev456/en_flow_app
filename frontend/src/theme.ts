import Zoom from "@mui/material/Zoom";
import { alpha, createTheme, type Theme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

export type AppThemeMode = "dark" | "warmLight";
export type AppStatusSemantic = "active" | "waiting" | "finalized" | "cancelled" | "problem" | "neutral";

export type AppStatusVisualToken = {
  main: string;
  onMain: string;
  container: string;
  onContainer: string;
  border: string;
  accent: string;
  soft: string;
};

type AppMotionTokens = {
  micro: number;
  short: number;
  medium: number;
  layout: number;
  pageOffsetY: number;
};

type AppElevationTokens = {
  surface: string;
  raised: string;
  overlay: string;
};

type AppShapeTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  pill: number;
};

declare module "@mui/material/styles" {
  interface Palette {
    outline: string;
    outlineVariant: string;
    onSurfaceVariant: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    status: Record<AppStatusSemantic, AppStatusVisualToken>;
  }

  interface PaletteOptions {
    outline?: string;
    outlineVariant?: string;
    onSurfaceVariant?: string;
    surfaceContainerLowest?: string;
    surfaceContainerLow?: string;
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
    status?: Partial<Record<AppStatusSemantic, AppStatusVisualToken>>;
  }

  interface Theme {
    appMotion: AppMotionTokens;
    appElevation: AppElevationTokens;
    appShape: AppShapeTokens;
  }

  interface ThemeOptions {
    appMotion?: Partial<AppMotionTokens>;
    appElevation?: Partial<AppElevationTokens>;
    appShape?: Partial<AppShapeTokens>;
  }
}

const fontStack = ["Inter", "Roboto", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"].join(",");

export function getStatusSemanticKey(statusTone: string): AppStatusSemantic {
  if (statusTone === "en_proceso" || statusTone === "activo") return "active";
  if (statusTone === "espera" || statusTone === "espera_externa") return "waiting";
  if (statusTone === "finalizado" || statusTone === "completado" || statusTone === "resuelto") return "finalized";
  if (statusTone === "cancelado") return "cancelled";
  if (statusTone === "problema" || statusTone === "error") return "problem";
  return "neutral";
}

export function getStatusToken(theme: Theme, statusTone: string): AppStatusVisualToken {
  return theme.palette.status[getStatusSemanticKey(statusTone)];
}

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  const motion: AppMotionTokens = {
    micro: 140,
    short: 190,
    medium: 240,
    layout: 280,
    pageOffsetY: 12,
  };

  const shape: AppShapeTokens = {
    xs: 2,
    sm: 3,
    md: 4,
    lg: 6,
    pill: 999,
  };

  const palette = {
    mode: isDark ? "dark" : "light",
    primary: {
      main: isDark ? "#88b4ff" : "#315fd3",
      light: isDark ? "#b8d0ff" : "#5f84e3",
      dark: isDark ? "#5f84e3" : "#2047ac",
      contrastText: isDark ? "#04101f" : "#ffffff",
    },
    secondary: {
      main: isDark ? "#86d4cf" : "#2f7d77",
      light: isDark ? "#afe8e2" : "#63a9a3",
      dark: isDark ? "#58b6af" : "#215f5a",
      contrastText: isDark ? "#081514" : "#ffffff",
    },
    success: {
      main: isDark ? "#7fd69b" : "#267d4f",
      light: isDark ? "#ace9bf" : "#4f9a71",
      dark: isDark ? "#58b57a" : "#1d633e",
      contrastText: isDark ? "#08170d" : "#ffffff",
    },
    warning: {
      main: isDark ? "#f2c97d" : "#b96f12",
      light: isDark ? "#f7dcaa" : "#cf9248",
      dark: isDark ? "#ddb15a" : "#91560d",
      contrastText: isDark ? "#1f1200" : "#ffffff",
    },
    error: {
      main: isDark ? "#ff9a90" : "#c93b31",
      light: isDark ? "#ffb9b2" : "#db6a62",
      dark: isDark ? "#e87870" : "#a82d24",
      contrastText: "#ffffff",
    },
    info: {
      main: isDark ? "#79c8ff" : "#1565c0",
      light: isDark ? "#a9dcff" : "#4c8dd4",
      dark: isDark ? "#4aa7e7" : "#0f4f97",
      contrastText: isDark ? "#05131f" : "#ffffff",
    },
    background: {
      default: isDark ? "#0e131a" : "#f5f7fb",
      paper: isDark ? "#151b24" : "#ffffff",
    },
    divider: isDark ? "rgba(207, 217, 236, 0.12)" : "rgba(58, 71, 92, 0.12)",
    outline: isDark ? "rgba(207, 217, 236, 0.18)" : "rgba(58, 71, 92, 0.18)",
    outlineVariant: isDark ? "rgba(207, 217, 236, 0.1)" : "rgba(58, 71, 92, 0.1)",
    text: {
      primary: isDark ? "#f4f7ff" : "#182131",
      secondary: isDark ? "rgba(228, 234, 245, 0.7)" : "rgba(34, 45, 65, 0.68)",
    },
    onSurfaceVariant: isDark ? "rgba(228, 234, 245, 0.78)" : "rgba(34, 45, 65, 0.78)",
    surfaceContainerLowest: isDark ? "#0b1016" : "#ffffff",
    surfaceContainerLow: isDark ? "#111822" : "#fbfcff",
    surfaceContainer: isDark ? "#16202b" : "#f2f5fa",
    surfaceContainerHigh: isDark ? "#1d2835" : "#e9eef6",
    surfaceContainerHighest: isDark ? "#253241" : "#dde5f0",
    status: {
      active: {
        main: isDark ? "#8cc7ff" : "#1565c0",
        onMain: isDark ? "#05131f" : "#ffffff",
        container: isDark ? "rgba(36, 114, 196, 0.3)" : "rgba(21, 101, 192, 0.11)",
        onContainer: isDark ? "#d8edff" : "#0f4f97",
        border: isDark ? "rgba(136, 196, 255, 0.35)" : "rgba(21, 101, 192, 0.22)",
        accent: isDark ? "#79c8ff" : "#1565c0",
        soft: isDark ? "rgba(121, 200, 255, 0.14)" : "rgba(21, 101, 192, 0.09)",
      },
      waiting: {
        main: isDark ? "#f2c97d" : "#b96f12",
        onMain: isDark ? "#1f1200" : "#ffffff",
        container: isDark ? "rgba(185, 111, 18, 0.28)" : "rgba(185, 111, 18, 0.12)",
        onContainer: isDark ? "#ffe9bf" : "#91560d",
        border: isDark ? "rgba(242, 201, 125, 0.32)" : "rgba(185, 111, 18, 0.22)",
        accent: isDark ? "#f2c97d" : "#b96f12",
        soft: isDark ? "rgba(242, 201, 125, 0.14)" : "rgba(185, 111, 18, 0.1)",
      },
      finalized: {
        main: isDark ? "#7fd69b" : "#267d4f",
        onMain: isDark ? "#08170d" : "#ffffff",
        container: isDark ? "rgba(38, 125, 79, 0.28)" : "rgba(38, 125, 79, 0.11)",
        onContainer: isDark ? "#d8f4e2" : "#1d633e",
        border: isDark ? "rgba(127, 214, 155, 0.28)" : "rgba(38, 125, 79, 0.2)",
        accent: isDark ? "#7fd69b" : "#267d4f",
        soft: isDark ? "rgba(127, 214, 155, 0.14)" : "rgba(38, 125, 79, 0.09)",
      },
      cancelled: {
        main: isDark ? "#a9b4c5" : "#66748b",
        onMain: isDark ? "#0e131a" : "#ffffff",
        container: isDark ? "rgba(124, 136, 155, 0.26)" : "rgba(102, 116, 139, 0.1)",
        onContainer: isDark ? "#d9dfeb" : "#4b576b",
        border: isDark ? "rgba(169, 180, 197, 0.24)" : "rgba(102, 116, 139, 0.18)",
        accent: isDark ? "#a9b4c5" : "#66748b",
        soft: isDark ? "rgba(169, 180, 197, 0.12)" : "rgba(102, 116, 139, 0.08)",
      },
      problem: {
        main: isDark ? "#ff9a90" : "#c93b31",
        onMain: "#ffffff",
        container: isDark ? "rgba(201, 59, 49, 0.28)" : "rgba(201, 59, 49, 0.11)",
        onContainer: isDark ? "#ffdcd8" : "#a82d24",
        border: isDark ? "rgba(255, 154, 144, 0.28)" : "rgba(201, 59, 49, 0.2)",
        accent: isDark ? "#ff9a90" : "#c93b31",
        soft: isDark ? "rgba(255, 154, 144, 0.13)" : "rgba(201, 59, 49, 0.08)",
      },
      neutral: {
        main: isDark ? "#bfc8d8" : "#536179",
        onMain: isDark ? "#09111a" : "#ffffff",
        container: isDark ? "rgba(83, 97, 121, 0.26)" : "rgba(83, 97, 121, 0.09)",
        onContainer: isDark ? "#e3e8f2" : "#3f4b60",
        border: isDark ? "rgba(191, 200, 216, 0.22)" : "rgba(83, 97, 121, 0.18)",
        accent: isDark ? "#bfc8d8" : "#536179",
        soft: isDark ? "rgba(191, 200, 216, 0.11)" : "rgba(83, 97, 121, 0.08)",
      },
    },
  } as const;

  const elevation: AppElevationTokens = {
    surface: isDark
      ? "0 1px 2px rgba(0, 0, 0, 0.18), 0 8px 22px rgba(0, 0, 0, 0.18)"
      : "0 1px 2px rgba(22, 32, 49, 0.04), 0 12px 28px rgba(22, 32, 49, 0.06)",
    raised: isDark
      ? "0 2px 4px rgba(0, 0, 0, 0.22), 0 14px 28px rgba(0, 0, 0, 0.24)"
      : "0 2px 6px rgba(22, 32, 49, 0.06), 0 18px 36px rgba(22, 32, 49, 0.1)",
    overlay: isDark
      ? "0 8px 18px rgba(0, 0, 0, 0.28), 0 28px 56px rgba(0, 0, 0, 0.34)"
      : "0 10px 24px rgba(22, 32, 49, 0.12), 0 28px 60px rgba(22, 32, 49, 0.18)",
  };

  return createTheme({
    palette,
    appMotion: motion,
    appElevation: elevation,
    appShape: shape,
    shape: {
      borderRadius: shape.md,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: { fontSize: "2.1rem", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.08 },
      h2: { fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.12 },
      h3: { fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.16 },
      h4: { fontSize: "1.24rem", fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.2 },
      h5: { fontSize: "1.06rem", fontWeight: 700, lineHeight: 1.28 },
      h6: { fontSize: "0.96rem", fontWeight: 700, lineHeight: 1.3 },
      subtitle1: { fontSize: "0.98rem", fontWeight: 600, lineHeight: 1.45 },
      subtitle2: { fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.4 },
      body1: { fontSize: "0.96rem", lineHeight: 1.58 },
      body2: { fontSize: "0.88rem", lineHeight: 1.52 },
      caption: { fontSize: "0.75rem", lineHeight: 1.4, letterSpacing: "0.02em" },
      button: { textTransform: "none", fontWeight: 700, letterSpacing: "0.01em" },
    },
    transitions: {
      easing: {
        easeInOut: "cubic-bezier(0.2, 0, 0, 1)",
        easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
        easeIn: "cubic-bezier(0.32, 0, 0.67, 0)",
        sharp: "cubic-bezier(0.2, 0, 0, 1)",
      },
      duration: {
        shortest: motion.micro,
        shorter: motion.short,
        short: motion.short,
        standard: motion.medium,
        complex: motion.layout,
        enteringScreen: motion.medium,
        leavingScreen: motion.short,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          html: { minHeight: "100%", backgroundColor: theme.palette.background.default },
          body: {
            minHeight: "100%",
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
          },
          "#root": { minHeight: "100vh" },
          a: { color: "inherit", textDecoration: "none" },
          "::selection": {
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: isDark ? alpha(theme.palette.common.white, 0.18) : alpha(theme.palette.text.secondary, 0.2),
            borderRadius: theme.appShape.pill,
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
        }),
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            boxShadow: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.surfaceContainerLow, isDark ? 0.94 : 0.96),
            borderRight: `1px solid ${theme.palette.outlineVariant}`,
            boxShadow: "none",
            backgroundImage: "none",
          }),
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.surfaceContainerLowest,
            border: `1px solid ${theme.palette.outlineVariant}`,
            borderRadius: theme.appShape.lg,
            boxShadow: theme.appElevation.surface,
            transition: theme.transitions.create(["border-color", "box-shadow", "background-color"], {
              duration: theme.appMotion.short,
            }),
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 38,
            borderRadius: theme.appShape.md,
            paddingInline: 16,
            transition: theme.transitions.create(["background-color", "border-color", "box-shadow", "color"], {
              duration: theme.appMotion.short,
            }),
          }),
          contained: ({ theme }) => ({
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
            "&.Mui-disabled": {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
              color: alpha(theme.palette.primary.contrastText, isDark ? 0.62 : 0.88),
            },
          }),
          outlined: ({ theme }) => ({
            borderColor: theme.palette.outline,
            backgroundColor: alpha(theme.palette.surfaceContainerLowest, 0.88),
            "&:hover": {
              borderColor: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.05),
            },
          }),
          text: ({ theme }) => ({
            "&:hover": {
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.05),
            },
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.appShape.md,
            transition: theme.transitions.create(["background-color", "color", "border-color"], {
              duration: theme.appMotion.short,
            }),
          }),
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
            borderRadius: theme.appShape.md,
            backgroundColor: alpha(theme.palette.surfaceContainerLow, isDark ? 0.78 : 0.95),
            transition: theme.transitions.create(["background-color", "border-color", "box-shadow"], {
              duration: theme.appMotion.short,
            }),
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.outline,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.onSurfaceVariant,
            },
            "&.Mui-focused": {
              backgroundColor: alpha(theme.palette.surfaceContainerLowest, 0.98),
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12)}`,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
            },
          }),
          input: {
            paddingTop: 11,
            paddingBottom: 11,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.appShape.pill,
            fontWeight: 700,
            border: `1px solid ${theme.palette.outlineVariant}`,
            backgroundColor: theme.palette.surfaceContainerLow,
            transition: theme.transitions.create(["background-color", "border-color", "color", "box-shadow"], {
              duration: theme.appMotion.short,
            }),
          }),
          filled: ({ theme }) => ({
            backgroundColor: theme.palette.surfaceContainer,
          }),
          outlined: ({ theme }) => ({
            borderColor: theme.palette.outline,
          }),
        },
      },
      MuiDialog: {
        defaultProps: {
          slots: { transition: Zoom },
          transitionDuration: { enter: motion.medium, exit: motion.short },
        },
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.surfaceContainerLowest,
            border: `1px solid ${theme.palette.outlineVariant}`,
            borderRadius: theme.appShape.lg,
            boxShadow: theme.appElevation.overlay,
          }),
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
          slots: { transition: Zoom },
          enterDelay: 320,
          enterNextDelay: 140,
        },
        styleOverrides: {
          tooltip: ({ theme }) => ({
            borderRadius: theme.appShape.md,
            backgroundColor: isDark ? alpha("#02050a", 0.92) : alpha("#182131", 0.92),
            border: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.08 : 0.12)}`,
            boxShadow: theme.appElevation.overlay,
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
            borderBottom: `1px solid ${theme.palette.outlineVariant}`,
            backgroundColor: alpha(theme.palette.surfaceContainerLow, 0.9),
          }),
          body: ({ theme }) => ({
            borderBottom: `1px solid ${alpha(theme.palette.outlineVariant, 0.92)}`,
          }),
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: 4,
            borderRadius: theme.appShape.md,
            border: `1px solid ${theme.palette.outlineVariant}`,
            backgroundColor: alpha(theme.palette.surfaceContainerLow, isDark ? 0.9 : 0.96),
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: 0,
            borderRadius: theme.appShape.sm,
            color: theme.palette.text.secondary,
            fontWeight: 600,
            paddingInline: 12,
            transition: theme.transitions.create(["background-color", "color", "box-shadow"], {
              duration: theme.appMotion.short,
            }),
            "&.Mui-selected": {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.surfaceContainerHighest,
              boxShadow: `inset 0 0 0 1px ${theme.palette.outlineVariant}`,
            },
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.appShape.md,
            transition: theme.transitions.create(["background-color", "border-color", "color"], {
              duration: theme.appMotion.short,
            }),
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
            },
          }),
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.surfaceContainerLowest,
            border: `1px solid ${theme.palette.outlineVariant}`,
            borderRadius: theme.appShape.md,
            boxShadow: theme.appElevation.overlay,
          }),
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: ({ theme }) => ({
            height: 4,
            borderRadius: theme.appShape.pill,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
          }),
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.outlineVariant}`,
            borderRadius: theme.appShape.lg,
            backgroundColor: theme.palette.surfaceContainerLowest,
            color: theme.palette.text.primary,
            "--DataGrid-rowBorderColor": alpha(theme.palette.outlineVariant, 0.96),
            "--DataGrid-containerBackground": theme.palette.surfaceContainerLowest,
            "--DataGrid-pinnedBackground": theme.palette.surfaceContainerLow,
            "--DataGrid-headerBackground": theme.palette.surfaceContainerLow,
          }),
          columnHeaders: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.surfaceContainerLow, 0.96),
            borderBottom: `1px solid ${theme.palette.outlineVariant}`,
          }),
          columnHeaderTitle: ({ theme }) => ({
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: theme.palette.text.secondary,
          }),
          toolbarContainer: ({ theme }) => ({
            padding: theme.spacing(1.1, 1.4),
            borderBottom: `1px solid ${theme.palette.outlineVariant}`,
            gap: theme.spacing(0.75),
            alignItems: "center",
            backgroundColor: alpha(theme.palette.surfaceContainerLowest, 0.98),
            "& .MuiDataGrid-toolbarButton": {
              minWidth: 34,
              minHeight: 34,
              borderRadius: theme.appShape.md,
            },
            "& .MuiDataGrid-toolbarButton .MuiSvgIcon-root": {
              fontSize: "1rem",
            },
            "& .MuiDataGrid-toolbarQuickFilterControl .MuiInputBase-root": {
              minHeight: 36,
            },
          }),
          footerContainer: ({ theme }) => ({
            borderTop: `1px solid ${theme.palette.outlineVariant}`,
            backgroundColor: alpha(theme.palette.surfaceContainerLow, 0.92),
          }),
          row: ({ theme }) => ({
            cursor: "pointer",
            transition: theme.transitions.create("background-color", {
              duration: theme.appMotion.short,
            }),
            "&:hover": {
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.035),
            },
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08),
            },
            "&.Mui-selected:hover": {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.11),
            },
          }),
          cell: {
            borderTop: "none",
            "&:focus": {
              outline: "none",
            },
            "&:focus-within": {
              outline: "none",
            },
          },
          columnHeader: {
            "&:focus": {
              outline: "none",
            },
            "&:focus-within": {
              outline: "none",
            },
          },
          overlayWrapperInner: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.surfaceContainerLowest, 0.96),
          }),
        },
      },
    },
  });
}
