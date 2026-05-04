import { alpha, createTheme } from "@mui/material/styles";

const systemFontStack = [
  "Inter",
  "Segoe UI",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
].join(",");

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#5ea8ff",
      light: "#9ecbff",
      dark: "#2d76cf",
      contrastText: "#08111f",
    },
    secondary: {
      main: "#73d6c5",
      light: "#acecdf",
      dark: "#369786",
      contrastText: "#071411",
    },
    success: {
      main: "#46c97b",
      light: "#83e3aa",
      dark: "#22844c",
      contrastText: "#04130b",
    },
    warning: {
      main: "#ffb54d",
      light: "#ffd18c",
      dark: "#b97816",
      contrastText: "#1a1205",
    },
    error: {
      main: "#ff6f7d",
      light: "#ffb1b7",
      dark: "#c93d50",
      contrastText: "#170508",
    },
    info: {
      main: "#63c4ff",
      light: "#a7e0ff",
      dark: "#2a84bf",
      contrastText: "#06131a",
    },
    background: {
      default: "#0b1020",
      paper: "#121a2b",
    },
    divider: "rgba(147, 169, 198, 0.16)",
    text: {
      primary: "#ecf3ff",
      secondary: "#a9b8cd",
    },
  },
  shape: {
    borderRadius: 16,
  },
  spacing: 8,
  typography: {
    fontFamily: systemFontStack,
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
      fontSize: "0.875rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    },
    body1: {
      lineHeight: 1.65,
    },
    body2: {
      lineHeight: 1.55,
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
          backgroundImage: [
            `radial-gradient(circle at top left, ${alpha(themeParam.palette.primary.main, 0.18)}, transparent 26%)`,
            `radial-gradient(circle at top right, ${alpha(themeParam.palette.secondary.main, 0.12)}, transparent 24%)`,
            "linear-gradient(180deg, #09101c 0%, #0b1020 52%, #0f1628 100%)",
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
          backgroundColor: alpha(themeParam.palette.common.white, 0.18),
          borderRadius: 999,
        },
      }),
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(147, 169, 198, 0.14)",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
          minHeight: 42,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: "1px solid rgba(147, 169, 198, 0.12)",
          backgroundImage: "linear-gradient(180deg, rgba(20, 28, 44, 0.98), rgba(14, 20, 34, 0.98))",
          boxShadow: "0 18px 44px rgba(0, 0, 0, 0.18)",
        },
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
        root: {
          borderRadius: 14,
          backgroundColor: alpha("#0d1424", 0.7),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          border: "1px solid rgba(147, 169, 198, 0.14)",
          backgroundImage: "linear-gradient(180deg, rgba(19, 27, 43, 0.98), rgba(14, 20, 34, 0.98))",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#8fa7c4",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(147, 169, 198, 0.18)",
        },
        body: {
          borderBottom: "1px solid rgba(147, 169, 198, 0.1)",
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          padding: 4,
          borderRadius: 999,
          backgroundColor: alpha("#11192c", 0.9),
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0,
          borderRadius: 999,
          paddingInline: 16,
        },
      },
    },
  },
});
