import { alpha, createTheme } from "@mui/material/styles";

export type AppThemeMode = "dark" | "warmLight";

const fontStack = [
  "Manrope",
  "Nunito Sans",
  "Segoe UI",
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
          main: "#5ea8ff",
          light: "#9ecbff",
          dark: "#2d76cf",
          contrastText: "#08111f",
        }
      : {
          main: "#256f78",
          light: "#4f9aa3",
          dark: "#164e55",
          contrastText: "#ffffff",
        },
    secondary: isDark
      ? {
          main: "#73d6c5",
          light: "#acecdf",
          dark: "#369786",
          contrastText: "#071411",
        }
      : {
          main: "#8a6f45",
          light: "#b89a68",
          dark: "#5f4a2d",
          contrastText: "#ffffff",
        },
    success: {
      main: isDark ? "#46c97b" : "#3f7d52",
    },
    warning: {
      main: isDark ? "#ffb54d" : "#b7791f",
    },
    error: {
      main: isDark ? "#ff6f7d" : "#b45353",
    },
    info: {
      main: isDark ? "#63c4ff" : "#3b7890",
    },
    background: {
      default: isDark ? "#0b1020" : "#f6f1e8",
      paper: isDark ? "#121a2b" : "#fffaf2",
    },
    divider: isDark ? "rgba(147, 169, 198, 0.16)" : "rgba(116, 94, 68, 0.16)",
    text: {
      primary: isDark ? "#ecf3ff" : "#25211d",
      secondary: isDark ? "#a9b8cd" : "#6f665c",
    },
  };

  return createTheme({
    palette,
    shape: {
      borderRadius: 14,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      h1: {
        fontSize: "2.4rem",
        fontWeight: 700,
        letterSpacing: "-0.04em",
      },
      h2: {
        fontSize: "1.9rem",
        fontWeight: 700,
        letterSpacing: "-0.03em",
      },
      h3: {
        fontSize: "1.3rem",
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h4: {
        fontSize: "1.05rem",
        fontWeight: 700,
      },
      subtitle1: {
        fontSize: "1rem",
        lineHeight: 1.6,
      },
      subtitle2: {
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
      },
      body1: {
        lineHeight: 1.62,
      },
      body2: {
        lineHeight: 1.5,
      },
      button: {
        fontWeight: 700,
        textTransform: "none",
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
                  `radial-gradient(circle at top left, ${alpha(themeParam.palette.primary.main, 0.18)}, transparent 28%)`,
                  `radial-gradient(circle at top right, ${alpha(themeParam.palette.secondary.main, 0.14)}, transparent 22%)`,
                  "linear-gradient(180deg, #09101c 0%, #0b1020 52%, #0f1628 100%)",
                ].join(",")
              : [
                  `radial-gradient(circle at top left, ${alpha(themeParam.palette.primary.main, 0.12)}, transparent 30%)`,
                  `radial-gradient(circle at top right, ${alpha(themeParam.palette.secondary.main, 0.12)}, transparent 26%)`,
                  "linear-gradient(180deg, #f9f4ec 0%, #f6f1e8 48%, #f3ede2 100%)",
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
            backdropFilter: "blur(16px)",
            borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.8 : 1)}`,
            boxShadow: "none",
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
            paddingInline: 16,
            minHeight: 40,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 14,
            border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.9 : 1)}`,
            backgroundImage: isDark
              ? "linear-gradient(180deg, rgba(20, 28, 44, 0.98), rgba(14, 20, 34, 0.98))"
              : "linear-gradient(180deg, rgba(255, 252, 245, 0.98), rgba(255, 248, 238, 0.98))",
            boxShadow: isDark ? "0 18px 44px rgba(0, 0, 0, 0.18)" : "0 10px 24px rgba(98, 76, 52, 0.08)",
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
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            backgroundColor: isDark ? alpha(theme.palette.background.default, 0.72) : alpha(theme.palette.background.default, 0.5),
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
            borderRadius: 10,
            fontWeight: 700,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 14,
            border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.9 : 1)}`,
            backgroundImage: isDark
              ? "linear-gradient(180deg, rgba(19, 27, 43, 0.98), rgba(14, 20, 34, 0.98))"
              : "linear-gradient(180deg, rgba(255, 252, 246, 0.99), rgba(255, 247, 236, 0.99))",
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({
            color: theme.palette.text.secondary,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 1 : 0.95)}`,
          }),
          body: ({ theme }) => ({
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
          }),
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: 4,
            borderRadius: 10,
            backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.5) : alpha(theme.palette.background.paper, 0.8),
            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: 0,
            borderRadius: 8,
            paddingInline: 14,
            color: theme.palette.text.secondary,
            "&.Mui-selected": {
              color: theme.palette.text.primary,
              backgroundColor: isDark ? alpha(theme.palette.primary.main, 0.24) : alpha(theme.palette.primary.main, 0.15),
            },
          }),
        },
      },
    },
  });
}
