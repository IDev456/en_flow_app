import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { AppBar, Box, IconButton, Stack, Toolbar, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { AppThemeMode } from "../../theme";

type DashboardHeaderProps = {
  mode: AppThemeMode;
  collapsed: boolean;
  onToggleMode: () => void;
  onToggleDesktopNav: () => void;
  onOpenMobileNav: () => void;
};

export function DashboardHeader({
  mode,
  collapsed,
  onToggleMode,
  onToggleDesktopNav,
  onOpenMobileNav,
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
        bgcolor: alpha(theme.palette.surfaceContainerLowest, theme.palette.mode === "dark" ? 0.88 : 0.92),
        borderBottom: "1px solid",
        borderColor: "outlineVariant",
        backdropFilter: "blur(18px)",
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 1.2 }}>
        <Tooltip title={isDesktop ? (collapsed ? "Expandir navegacion" : "Colapsar navegacion") : "Abrir navegacion"}>
          <IconButton
            color="inherit"
            onClick={isDesktop ? onToggleDesktopNav : onOpenMobileNav}
            aria-label="Alternar navegacion"
            sx={{
              border: "1px solid",
              borderColor: "outline",
              bgcolor: "surfaceContainerLow",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.06),
              },
            }}
          >
            {isDesktop ? (collapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />) : <MenuRoundedIcon />}
          </IconButton>
        </Tooltip>

        <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "primary.main",
              boxShadow: (appTheme) => `0 0 0 5px ${alpha(appTheme.palette.primary.main, 0.14)}`,
            }}
          />
          <Stack spacing={0.1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
              En Flow
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
              Operacion guiada y trazabilidad
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
          <Tooltip title={mode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}>
            <IconButton
              color="inherit"
              onClick={onToggleMode}
              aria-label={mode === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
              sx={{
                border: "1px solid",
                borderColor: "outline",
                bgcolor: "surfaceContainerLow",
                "&:hover": {
                  bgcolor: alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.18 : 0.08),
                },
              }}
            >
              {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
