import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
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

import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";
import { AppThemeMode, createAppTheme } from "./theme";

const THEME_STORAGE_KEY = "enflow_theme_mode";
const DRAWER_WIDTH = 268;

type NavItem = {
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
};

const navigationItems: NavItem[] = [
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

  const sectionData = useMemo(() => getSectionData(location.pathname), [location.pathname]);
  const params = new URLSearchParams(location.search);
  const isCreateModalOpen = params.get("modal") === "capture";

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

  function isRouteActive(path: string) {
    if (path === "/flows") return location.pathname === "/flows" || location.pathname.startsWith("/workflows/") || location.pathname.startsWith("/steps/");
    if (path === "/requirements") {
      return location.pathname === "/requirements" || location.pathname.startsWith("/requirements/") || location.pathname.startsWith("/triggers/");
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", p: 2.25, pb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.14),
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.3),
          }}
        >
          <AssignmentTurnedInRoundedIcon color="primary" fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            En Flow
          </Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
            CRUD Workspace
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <List sx={{ px: 1.25, py: 1.5, gap: 0.6, display: "grid" }}>
        {navigationItems.map((item) => {
          const active = isRouteActive(item.path);
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileDrawerOpen(false);
              }}
              selected={active}
              sx={{
                borderRadius: 2,
                alignItems: "flex-start",
                py: 1,
                px: 1.15,
                border: "1px solid",
                borderColor: active ? alpha(theme.palette.primary.main, 0.35) : "transparent",
                bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : "transparent",
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: active ? "primary.main" : "text.secondary", mt: 0.2 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                slotProps={{
                  primary: { sx: { fontWeight: active ? 700 : 600 } },
                  secondary: { variant: "caption", sx: { mt: 0.2 } },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ mt: "auto", p: 2 }}>
        <Chip label="Operación guiada" color="primary" variant="outlined" size="small" />
      </Box>
    </Box>
  );

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
          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.9 : 0.82),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ mr: 1, display: { md: "none" } }}
            aria-label="Abrir navegación"
          >
            <MenuRoundedIcon />
          </IconButton>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {sectionData.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              {sectionData.subtitle}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip title={mode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}>
              <IconButton
                color="inherit"
                onClick={onToggleMode}
                aria-label={mode === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
                sx={{ border: "1px solid", borderColor: "divider", bgcolor: alpha(theme.palette.background.default, 0.3) }}
              >
                {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Button variant="contained" startIcon={<AddCircleOutlineRoundedIcon />} onClick={openCreateModal}>
              Capturar tarea
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3 },
          py: { xs: 2.25, md: 3 },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <Box sx={{ maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </Box>
  );
}

export default App;
