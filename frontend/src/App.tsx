import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { alpha } from "@mui/material/styles";
import { AppBar, Box, Button, Container, CssBaseline, IconButton, Stack, ThemeProvider, Toolbar, Tooltip, Typography, useTheme } from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";
import { AppThemeMode, createAppTheme } from "./theme";

const THEME_STORAGE_KEY = "enflow_theme_mode";

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
      <AppLayout mode={mode} onToggleMode={toggleMode} />
    </ThemeProvider>
  );
}

type AppLayoutProps = {
  mode: AppThemeMode;
  onToggleMode: () => void;
};

function AppLayout({ mode, onToggleMode }: AppLayoutProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isCreateModalOpen = params.get("modal") === "capture";

  function closeCreateModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("modal");
    const nextSearch = nextParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
  }

  function isRouteActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          backgroundColor: alpha(theme.palette.background.default, isDark ? 0.72 : 0.86),
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: { xs: 70, md: 80 }, gap: 2, justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  background: isDark
                    ? "linear-gradient(135deg, rgba(94, 168, 255, 0.22), rgba(115, 214, 197, 0.24))"
                    : "linear-gradient(135deg, rgba(37, 111, 120, 0.16), rgba(184, 154, 104, 0.16))",
                  border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                }}
              >
                <AssignmentTurnedInRoundedIcon color="primary" />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="primary.light">
                  En Flow
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Continuidad operativa
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", rowGap: 0.5 }}
            >
              <Button variant="text" color="inherit" onClick={() => navigate("/flows")}>
                <Box component="span" sx={{ fontWeight: isRouteActive("/flows") ? 800 : 600 }}>
                  Flows
                </Box>
              </Button>
              <Button variant="text" color="inherit" onClick={() => navigate("/requirements")}>
                <Box component="span" sx={{ fontWeight: isRouteActive("/requirements") ? 800 : 600 }}>
                  Requerimientos
                </Box>
              </Button>
              <Tooltip title={mode === "dark" ? "Cambiar a claro cálido" : "Cambiar a oscuro"}>
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={onToggleMode}
                  aria-label={mode === "dark" ? "Activar tema claro cálido" : "Activar tema oscuro"}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: alpha(theme.palette.background.paper, isDark ? 0.28 : 0.72),
                  }}
                >
                  {mode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineRoundedIcon />}
                onClick={() => navigate(`${location.pathname}?modal=capture`)}
              >
                Capturar tarea
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        maxWidth="xl"
        sx={{
          py: { xs: 3, md: 4 },
        }}
      >
        <Box>
          <Routes>
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
          </Routes>
        </Box>
      </Container>
      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </Box>
  );
}

export default App;
