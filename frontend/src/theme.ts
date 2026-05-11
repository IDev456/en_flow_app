import { alpha, createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

export type AppThemeMode = "dark" | "warmLight";

const fontStack = ["Public Sans", "Inter", "Manrope", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"].join(",");

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: isDark ? "#86a9d8" : "#4f6f95",
        light: isDark ? "#a9c1e2" : "#6f8aad",
        dark: isDark ? "#6f92bf" : "#3f5879",
        contrastText: isDark ? "#0f172a" : "#ffffff",
      },
      secondary: {
        main: isDark ? "#9ca3af" : "#6b7280",
        contrastText: isDark ? "#111827" : "#ffffff",
      },
      success: {
        main: isDark ? "#4ec89a" : "#2f7d62",
      },
      warning: {
        main: isDark ? "#e0b256" : "#b9861b",
      },
      error: {
        main: isDark ? "#d77b7b" : "#be4f4f",
      },
      info: {
        main: isDark ? "#7fa3d6" : "#3f78b9",
      },
      background: {
        default: isDark ? "#0f1115" : "#f8f9fb",
        paper: isDark ? "#151922" : "#ffffff",
      },
      divider: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(100, 116, 139, 0.2)",
      text: {
        primary: isDark ? "#e7e9ee" : "#111827",
        secondary: isDark ? "#9ea5b2" : "#6b7280",
      },
    },
    shape: {
      borderRadius: 10,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: { fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.04em" },
      h2: { fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontSize: "1.3rem", fontWeight: 700 },
      h4: { fontSize: "1.08rem", fontWeight: 700 },
      h5: { fontSize: "1rem", fontWeight: 700 },
      h6: { fontSize: "0.95rem", fontWeight: 700 },
      subtitle2: { fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em" },
      button: { textTransform: "none", fontWeight: 700 },
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
          root: ({ theme }) => ({
            boxShadow: "none",
            backgroundImage: "none",
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.98 : 1),
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            boxShadow: "none",
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 10,
            border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            boxShadow: "none",
            backgroundImage: "none",
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 10,
            minHeight: 36,
            paddingInline: 14,
          },
        },
        variants: [
          {
            props: { variant: "contained", color: "primary" },
            style: {
              backgroundColor: isDark ? "#f3f4f6" : "#111827",
              color: isDark ? "#111827" : "#f9fafb",
              "&:hover": {
                backgroundColor: isDark ? "#ffffff" : "#0b1220",
              },
            },
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
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
            borderRadius: 9,
            backgroundColor: isDark
              ? alpha(theme.palette.background.default, 0.32)
              : alpha(theme.palette.background.default, 0.72),
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(theme.palette.text.primary, 0.26),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.primary.main,
              borderWidth: 1.3,
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
            boxShadow: "none",
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
            borderRadius: 9,
            border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.96),
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
              border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
              backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.58 : 0.88),
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
            boxShadow: "none",
          }),
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${alpha(theme.palette.divider, 0.92)}`,
            borderRadius: 10,
            backgroundColor: theme.palette.background.paper,
            "--DataGrid-rowBorderColor": alpha(theme.palette.divider, 0.86),
          }),
          columnHeaders: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.38)
                : alpha(theme.palette.background.default, 0.72),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
          }),
          columnHeaderTitle: {
            fontWeight: 700,
          },
          toolbarContainer: ({ theme }) => ({
            padding: theme.spacing(1, 1.25),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            gap: theme.spacing(0.5),
          }),
          footerContainer: ({ theme }) => ({
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.default, 0.2)
                : alpha(theme.palette.background.default, 0.55),
          }),
          row: ({ theme }) => ({
            "&:hover": {
              backgroundColor: alpha(theme.palette.action.hover, 0.42),
            },
          }),
          cell: ({ theme }) => ({
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
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
