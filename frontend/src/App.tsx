import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";
import { AppThemeMode, createAppTheme } from "./theme";

const THEME_STORAGE_KEY = "enflow_theme_mode";
const DRAWER_STATE_KEY = "enflow_drawer_collapsed";
const DRAWER_EXPANDED_WIDTH = 268;
const DRAWER_COLLAPSED_WIDTH = 84;

type NavItem = {
  label: string;
  description: string;
  path?: string;
  icon: ReactNode;
  disabled?: boolean;
};

const primaryNavItems: NavItem[] = [
  {
    label: "Flows",
    description: "Secuencias activas y seguimiento",
    path: "/flows",
    icon: <TimelineRoundedIcon fontSize="small" />,
  },
  {
    label: "Requerimientos",
    description: "Entradas y agrupadores",
    path: "/requirements",
    icon: <FormatListBulletedRoundedIcon fontSize="small" />,
  },
];

const futureNavItems: NavItem[] = [
  {
    label: "Tareas",
    description: "Seguimiento operativo",
    icon: <FactCheckRoundedIcon fontSize="small" />,
    disabled: true,
  },
  {
    label: "Configuración",
    description: "Preferencias del tablero",
    icon: <SettingsRoundedIcon fontSize="small" />,
    disabled: true,
  },
];

function getSectionData(pathname: string) {
  if (pathname.startsWith("/flows")) {
    return { title: "Flows", subtitle: "Visión operativa de secuencias" };
  }
  if (pathname.startsWith("/requirements/")) {
    return { title: "Detalle de requerimiento", subtitle: "Contexto, estado y flows vinculados" };
  }
  if (pathname.startsWith("/requirements")) {
    return { title: "Requerimientos", subtitle: "Captura y seguimiento de solicitudes" };
  }
  if (pathname.startsWith("/workflows/")) {
    return { title: "Detalle de flow", subtitle: "Secuencia, tareas y trazabilidad" };
  }
  if (pathname.startsWith("/steps/")) {
    return { title: "Detalle de tarea", subtitle: "Ejecución y registro operativo" };
  }
  return { title: "En Flow", subtitle: "Gestión operativa" };
}

function App() {
  const [mode, setMode] = useState<AppThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "warmLight" ? "warmLight" : "dark";
  });

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  function toggleMode() {
    setMode((current) => {
      const next: AppThemeMode = current === "dark" ? "warmLight" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route element={<AppDashboardLayout mode={mode} onToggleMode={toggleMode} />}>
          <Route path="/" element={<Navigate to="/flows" replace />} />
          <Route path="/dashboard" element={<Navigate to="/flows" replace />} />
          <Route path="/board" element={<Navigate to="/flows" replace />} />
          <Route path="/flows" element={<TriggerListPage defaultView="flows" lockView title="Flows" />} />
          <Route path="/requirements" element={<TriggerListPage defaultView="requirements" lockView title="Requerimientos" />} />
          <Route path="/triggers" element={<Navigate to="/requirements" replace />} />
          <Route path="/triggers/new" element={<TriggerCreatePage />} />
          <Route path="/requirements/:triggerId" element={<TriggerDetailPage />} />
          <Route path="/triggers/:triggerId" element={<TriggerDetailPage />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
          <Route path="/steps/:stepId" element={<StepDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

type AppLayoutProps = {
  mode: AppThemeMode;
  onToggleMode: () => void;
};

function AppDashboardLayout({ mode, onToggleMode }: AppLayoutProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(() => localStorage.getItem(DRAWER_STATE_KEY) === "1");

  const sectionData = useMemo(() => getSectionData(location.pathname), [location.pathname]);
  const params = new URLSearchParams(location.search);
  const isCreateModalOpen = params.get("modal") === "capture";

  const desktopDrawerWidth = drawerCollapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_EXPANDED_WIDTH;

  function closeCreateModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("modal");
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function openCreateModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("modal", "capture");
    navigate(`${location.pathname}?${nextParams.toString()}`);
  }

  function toggleDesktopDrawer() {
    setDrawerCollapsed((current) => {
      const next = !current;
      localStorage.setItem(DRAWER_STATE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function isRouteActive(path: string) {
    if (path === "/flows") return location.pathname === "/flows" || location.pathname.startsWith("/workflows/") || location.pathname.startsWith("/steps/");
    if (path === "/requirements") {
      return location.pathname === "/requirements" || location.pathname.startsWith("/requirements/") || location.pathname.startsWith("/triggers/");
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  function renderNavItems(items: NavItem[], compact: boolean, closeOnNavigate: boolean) {
    return items.map((item) => {
      const active = item.path ? isRouteActive(item.path) : false;
      const content = (
        <ListItemButton
          key={item.label}
          selected={active}
          disabled={item.disabled}
          onClick={() => {
            if (!item.path || item.disabled) return;
            navigate(item.path);
            if (closeOnNavigate) {
              setMobileDrawerOpen(false);
            }
          }}
          sx={{
            borderRadius: 2,
            py: 1,
            px: compact ? 1 : 1.15,
            minHeight: 44,
            justifyContent: compact ? "center" : "flex-start",
            border: "1px solid",
            borderColor: active ? alpha(theme.palette.primary.main, 0.35) : "transparent",
            bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : "transparent",
            opacity: item.disabled ? 0.62 : 1,
            "&:hover": {
              bgcolor: active
                ? alpha(theme.palette.primary.main, 0.18)
                : alpha(theme.palette.action.hover, theme.palette.mode === "dark" ? 0.3 : 0.7),
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: compact ? 0 : 34,
              mr: compact ? 0 : 0.6,
              color: active ? "primary.main" : "text.secondary",
              justifyContent: "center",
            }}
          >
            {item.icon}
          </ListItemIcon>
          {!compact && (
            <ListItemText
              primary={item.label}
              secondary={item.description}
              slotProps={{
                primary: { sx: { fontWeight: active ? 700 : 600 } },
                secondary: { variant: "caption", sx: { mt: 0.1 } },
              }}
            />
          )}
        </ListItemButton>
      );

      if (!compact) return content;

      return (
        <Tooltip key={`${item.label}-tooltip`} title={item.disabled ? `${item.label} (próximamente)` : item.label} placement="right">
          <Box>{content}</Box>
        </Tooltip>
      );
    });
  }

  function renderDrawerContent(compact: boolean, mobile: boolean) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack
          direction="row"
          spacing={1.2}
          sx={{
            alignItems: "center",
            justifyContent: compact ? "center" : "space-between",
            px: compact ? 1 : 2.1,
            py: 1.7,
          }}
        >
          <Stack direction="row" spacing={compact ? 0 : 1.25} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.3),
              }}
            >
              <AssignmentTurnedInRoundedIcon color="primary" sx={{ fontSize: 18 }} />
            </Box>
            {!compact && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  En Flow
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  CRUD Dashboard
                </Typography>
              </Box>
            )}
          </Stack>

          {!mobile && !compact && (
            <Tooltip title="Colapsar barra lateral">
              <IconButton size="small" onClick={toggleDesktopDrawer}>
                <MenuOpenRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {!compact && <Divider />}

        <List sx={{ px: compact ? 1 : 1.25, pt: 1.4, pb: 0.8, display: "grid", gap: 0.55 }}>
          {!compact && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.6 }}>
              OPERACIÓN
            </Typography>
          )}
          {renderNavItems(primaryNavItems, compact, mobile)}
        </List>

        <Divider sx={{ mx: compact ? 1 : 1.25, my: 1 }} />

        <List sx={{ px: compact ? 1 : 1.25, pt: 0.4, pb: 1.25, display: "grid", gap: 0.55 }}>
          {!compact && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.6 }}>
              PRÓXIMAMENTE
            </Typography>
          )}
          {renderNavItems(futureNavItems, compact, mobile)}
        </List>

        <Box sx={{ mt: "auto", p: compact ? 1 : 2 }}>
          {compact ? (
            <Tooltip title="Operación guiada">
              <Chip label="●" size="small" color="primary" variant="outlined" sx={{ width: "100%" }} />
            </Tooltip>
          ) : (
            <Chip label="Operación guiada" size="small" color="primary" variant="outlined" />
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          zIndex: (appTheme) => appTheme.zIndex.drawer + 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.82 : 0.8),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 }, gap: 1.2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ display: { md: "none" } }}
            aria-label="Abrir navegación"
          >
            <MenuRoundedIcon />
          </IconButton>

          <Tooltip title={drawerCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}>
            <IconButton
              color="inherit"
              onClick={toggleDesktopDrawer}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
              aria-label="Alternar barra lateral"
            >
              {drawerCollapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />}
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.15 }}>
              {sectionData.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              {sectionData.subtitle}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
            <Tooltip title={mode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}>
              <IconButton
                color="inherit"
                onClick={onToggleMode}
                aria-label={mode === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
                sx={{ border: "1px solid", borderColor: "divider", bgcolor: alpha(theme.palette.background.default, 0.28) }}
              >
                {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Button variant="contained" startIcon={<AddCircleOutlineRoundedIcon />} onClick={openCreateModal} sx={{ minWidth: { xs: 0, sm: "auto" } }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Capturar tarea
              </Box>
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: desktopDrawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_EXPANDED_WIDTH },
          }}
        >
          {renderDrawerContent(false, true)}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: desktopDrawerWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.shorter,
              }),
            },
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 68 } }} />
          {renderDrawerContent(drawerCollapsed, false)}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 1.5, sm: 2.5, md: 3 },
          py: { xs: 2, md: 2.5 },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 68 } }} />
        <Box sx={{ maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </Box>
  );
}

export default App;
