import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { Box } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import type { AppThemeMode } from "../../theme";
import { DashboardHeader } from "./DashboardHeader";
import {
  DASHBOARD_DRAWER_COLLAPSED_WIDTH,
  DASHBOARD_DRAWER_EXPANDED_WIDTH,
  DashboardSidebar,
  type DashboardNavItem,
} from "./DashboardSidebar";

const DRAWER_STATE_KEY = "enflow_drawer_collapsed";

const navItems: DashboardNavItem[] = [
  {
    label: "Flows",
    description: "Secuencias activas",
    path: "/flows",
    icon: <TimelineRoundedIcon fontSize="small" />,
    group: "main",
  },
  {
    label: "Proyectos",
    description: "Entradas y seguimiento",
    path: "/requirements",
    icon: <FormatListBulletedRoundedIcon fontSize="small" />,
    group: "main",
  },
  {
    label: "Bitácora",
    description: "Registros globales",
    path: "/bitacora",
    icon: <HistoryRoundedIcon fontSize="small" />,
    group: "worklog",
  },
];

type DashboardLayoutProps = {
  mode: AppThemeMode;
  onToggleMode: () => void;
  children: ReactNode;
};

export function DashboardLayout({ mode, onToggleMode, children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(DRAWER_STATE_KEY) === "1");

  const drawerWidth = collapsed ? DASHBOARD_DRAWER_COLLAPSED_WIDTH : DASHBOARD_DRAWER_EXPANDED_WIDTH;

  function handleToggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(DRAWER_STATE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const isRouteActive = useMemo(
    () => (path: string) => {
      if (path === "/flows") {
        return location.pathname === "/flows" || location.pathname.startsWith("/workflows/") || location.pathname.startsWith("/steps/");
      }
      if (path === "/requirements") {
        return (
          location.pathname === "/requirements" ||
          location.pathname.startsWith("/requirements/") ||
          location.pathname.startsWith("/triggers/")
        );
      }
      if (path === "/bitacora") {
        return location.pathname === "/bitacora";
      }
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    },
    [location.pathname]
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <DashboardHeader
        mode={mode}
        collapsed={collapsed}
        onToggleMode={onToggleMode}
        onToggleDesktopNav={handleToggleCollapsed}
        onOpenMobileNav={() => setMobileOpen(true)}
      />

      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onNavigate={(path) => navigate(path)}
        isRouteActive={isRouteActive}
        navItems={navItems}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: "64px",
          height: "100vh",
          overflow: "auto",
        }}
      >
        <Box sx={{ px: { xs: 1.5, sm: 2.25, md: 3 }, py: { xs: 2, md: 2.5 }, maxWidth: 1680, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
