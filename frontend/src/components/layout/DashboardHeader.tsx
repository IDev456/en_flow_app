import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { AppThemeMode } from "../../theme";

type DashboardHeaderProps = {
  mode: AppThemeMode;
  collapsed: boolean;
  onToggleMode: () => void;
  onToggleDesktopNav: () => void;
  onOpenMobileNav: () => void;
  onOpenCapture: () => void;
};

export function DashboardHeader({
  mode,
  collapsed,
  onToggleMode,
  onToggleDesktopNav,
  onOpenMobileNav,
  onOpenCapture,
}: DashboardHeaderProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        zIndex: (appTheme) => appTheme.zIndex.drawer + 1,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.94 : 0.98),
        borderBottom: "1px solid",
        borderColor: "divider",
        backdropFilter: "blur(10px)",
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.2 }}>
        <Tooltip title={isDesktop ? (collapsed ? "Expandir navegación" : "Colapsar navegación") : "Abrir navegación"}>
          <IconButton
            color="inherit"
            onClick={isDesktop ? onToggleDesktopNav : onOpenMobileNav}
            aria-label="Alternar navegación"
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            {isDesktop ? (collapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />) : <MenuRoundedIcon />}
          </IconButton>
        </Tooltip>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            En Flow
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
            Dashboard
          </Typography>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
          <Tooltip title={mode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}>
            <IconButton
              color="inherit"
              onClick={onToggleMode}
              aria-label={mode === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
              sx={{ border: "1px solid", borderColor: "divider" }}
            >
              {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={onOpenCapture}
            sx={{
              borderRadius: 2,
              px: 1.5,
              bgcolor: theme.palette.mode === "dark" ? "#f3f4f6" : "#111827",
              color: theme.palette.mode === "dark" ? "#111827" : "#f9fafb",
              "&:hover": {
                bgcolor: theme.palette.mode === "dark" ? "#ffffff" : "#0b1220",
              },
            }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              Capturar tarea
            </Box>
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
