import { CssBaseline, ThemeProvider } from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PageTransition } from "./components/motion/PageTransition";
import { TriggerCreateModal } from "./features/flow/components/TriggerCreateModal";
import { NotFoundPage } from "./features/flow/pages/NotFoundPage";
import { StepDetailPage } from "./features/flow/pages/StepDetailPage";
import { TriggerCreatePage } from "./features/flow/pages/TriggerCreatePage";
import { TriggerDetailPage } from "./features/flow/pages/TriggerDetailPage";
import { TriggerListPage } from "./features/flow/pages/TriggerListPage";
import { WorkLogPage } from "./features/flow/pages/WorkLogPage";
import { WorkflowDetailPage } from "./features/flow/pages/WorkflowDetailPage";
import { AppThemeMode, createAppTheme } from "./theme";

const THEME_STORAGE_KEY = "enflow_theme_mode";

function App() {
  const [mode, setMode] = useState<AppThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" ? "dark" : "warmLight";
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
        <Route element={<AppShell mode={mode} onToggleMode={toggleMode} />}>
          <Route path="/" element={<Navigate to="/flows" replace />} />
          <Route path="/dashboard" element={<Navigate to="/flows" replace />} />
          <Route path="/board" element={<Navigate to="/flows" replace />} />
          <Route path="/flows" element={<TriggerListPage defaultView="flows" lockView title="Flows" />} />
          <Route path="/bitacora" element={<WorkLogPage />} />
          <Route
            path="/requirements"
            element={<TriggerListPage defaultView="requirements" lockView title="Proyectos" />}
          />
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

type AppShellProps = {
  mode: AppThemeMode;
  onToggleMode: () => void;
};

function AppShell({ mode, onToggleMode }: AppShellProps) {
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

  return (
    <DashboardLayout mode={mode} onToggleMode={onToggleMode}>
      <PageTransition transitionKey={location.pathname}>
        <Outlet />
      </PageTransition>
      {isCreateModalOpen && <TriggerCreateModal onClose={closeCreateModal} />}
    </DashboardLayout>
  );
}

export default App;
