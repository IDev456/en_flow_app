import { alpha, createTheme } from "@mui/material/styles";
import Zoom from "@mui/material/Zoom";
import type {} from "@mui/x-data-grid/themeAugmentation";

export type AppThemeMode = "dark" | "warmLight";

const fontStack = ["Roboto", "Inter", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"].join(",");

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: isDark ? "#90caf9" : "#1976d2",
        light: isDark ? "#bbdefb" : "#42a5f5",
        dark: isDark ? "#42a5f5" : "#1565c0",
        contrastText: isDark ? "rgba(0,0,0,0.87)" : "#fff",
      },
      secondary: {
        main: isDark ? "#ce93d8" : "#9c27b0",
        contrastText: isDark ? "rgba(0,0,0,0.87)" : "#fff",
      },
      success: {
        main: isDark ? "#66bb6a" : "#2e7d32",
      },
      warning: {
        main: isDark ? "#ffa726" : "#ed6c02",
      },
      error: {
        main: isDark ? "#f44336" : "#d32f2f",
      },
      info: {
        main: isDark ? "#29b6f6" : "#0288d1",
      },
      background: {
        default: isDark ? "#121212" : "#f5f5f5",
        paper: isDark ? "#1e1e1e" : "#ffffff",
      },
      divider: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
      text: {
        primary: isDark ? "#ffffff" : "rgba(0,0,0,0.87)",
        secondary: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
      },
    },
    shape: {
      borderRadius: 4,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: { fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.04em" },
      h2: { fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontSize: "1.3rem", fontWeight: 500 },
      h4: { fontSize: "1.08rem", fontWeight: 500 },
      h5: { fontSize: "1rem", fontWeight: 500 },
      h6: { fontSize: "0.95rem", fontWeight: 500 },
      subtitle2: { fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em" },
      button: { textTransform: "none", fontWeight: 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          html: { minHeight: "100%" },
          body: {
            minHeight: "100%",
            backgroundColor: theme.palette.background.default,
          },
          "#root": { minHeight: "100vh" },
          a: { color: "inherit", textDecoration: "none" },
          "*::-webkit-scrollbar": { width: 8, height: 8 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: isDark ? alpha(theme.palette.common.white, 0.2) : alpha(theme.palette.text.secondary, 0.26),
            borderRadius: 999,
          },
        }),
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${theme.palette.divider}`,
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
        defaultProps: {
          elevation: 1,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: false,
        },
        styleOverrides: {
          root: {
            minHeight: 34,
            paddingInline: 14,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: "50%",
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
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          slots: { transition: Zoom },
          transitionDuration: { enter: 220, exit: 160 },
        },
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
          slots: { transition: Zoom },
          enterDelay: 400,
          enterNextDelay: 200,
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
            borderBottom: `1px solid ${theme.palette.divider}`,
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
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.96),
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: 0,
            color: theme.palette.text.secondary,
            fontWeight: 500,
            paddingInline: 12,
            "&.Mui-selected": {
              color: theme.palette.text.primary,
              backgroundColor: alpha(theme.palette.background.default, isDark ? 0.58 : 0.88),
            },
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            transition: theme.transitions.create(["background-color"], {
              duration: theme.transitions.duration.shortest,
            }),
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }),
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
            backgroundColor: theme.palette.background.paper,
            "--DataGrid-rowBorderColor": alpha(theme.palette.divider, 0.86),
          }),
          columnHeaders: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.38)
                : alpha(theme.palette.background.default, 0.72),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
          columnHeaderTitle: ({ theme }) => ({
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.07em",
            textTransform: "uppercase" as const,
            color: theme.palette.text.secondary,
          }),
          toolbarContainer: ({ theme }) => ({
            padding: theme.spacing(1, 1.25),
            borderBottom: `1px solid ${theme.palette.divider}`,
            gap: theme.spacing(0.5),
            alignItems: "center",
            "& .MuiDataGrid-toolbarButton": {
              minWidth: 32,
              minHeight: 32,
            },
            "& .MuiDataGrid-toolbarButton .MuiSvgIcon-root": {
              fontSize: "1rem",
            },
            "& .MuiDataGrid-toolbarQuickFilterControl .MuiInputBase-root": {
              minHeight: 34,
            },
          }),
          footerContainer: ({ theme }) => ({
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.2)
                : alpha(theme.palette.background.default, 0.55),
          }),
          row: ({ theme }) => ({
            cursor: "pointer",
            "&:hover": {
              backgroundColor: alpha(theme.palette.action.hover, 0.42),
            },
          }),
          cell: ({}) => ({
            "&:focus": {
              outline: "none",
            },
            "&:focus-within": {
              outline: "none",
            },
          }),
          columnHeader: {
            "&:focus": {
              outline: "none",
            },
            "&:focus-within": {
              outline: "none",
            },
          },
        },
      },
    },
  });
}
