import type { ReactNode } from "react";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

export const DASHBOARD_DRAWER_EXPANDED_WIDTH = 268;
export const DASHBOARD_DRAWER_COLLAPSED_WIDTH = 84;

export type DashboardNavItem = {
  label: string;
  description?: string;
  path?: string;
  icon: ReactNode;
  disabled?: boolean;
  group: "main" | "worklog";
};

type DashboardSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onNavigate: (path: string) => void;
  isRouteActive: (path: string) => boolean;
  navItems: DashboardNavItem[];
};

function SectionTitle({ compact, children }: { compact: boolean; children: ReactNode }) {
  if (compact) return null;
  return (
    <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.65 }}>
      {children}
    </Typography>
  );
}

function SidebarBody({
  compact,
  mobile,
  onCloseMobile,
  navItems,
  isRouteActive,
  onNavigate,
}: {
  compact: boolean;
  mobile: boolean;
  onCloseMobile: () => void;
  navItems: DashboardNavItem[];
  isRouteActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}) {
  const theme = useTheme();
  const mainItems = navItems.filter((item) => item.group === "main");
  const workLogItems = navItems.filter((item) => item.group === "worklog");

  function renderItem(item: DashboardNavItem) {
    const active = item.path ? isRouteActive(item.path) : false;
    const button = (
      <ListItemButton
        key={item.label}
        selected={active}
        disabled={item.disabled}
        onClick={() => {
          if (!item.path || item.disabled) return;
          onNavigate(item.path);
          if (mobile) onCloseMobile();
        }}
        sx={{
          position: "relative",
          borderRadius: 2,
          py: 0.95,
          px: compact ? 1 : 1.25,
          minHeight: 44,
          justifyContent: compact ? "center" : "flex-start",
          border: "1px solid",
          borderColor: active ? alpha(theme.palette.text.primary, 0.16) : "transparent",
          bgcolor: active ? alpha(theme.palette.action.selected, theme.palette.mode === "dark" ? 0.52 : 0.92) : "transparent",
          opacity: item.disabled ? 0.54 : 1,
          "&:hover": {
            bgcolor: active
              ? alpha(theme.palette.action.selected, theme.palette.mode === "dark" ? 0.62 : 1)
              : alpha(theme.palette.action.hover, theme.palette.mode === "dark" ? 0.4 : 0.78),
          },
          "&.Mui-selected::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "20%",
            height: "60%",
            width: 3,
            borderRadius: "0 2px 2px 0",
            backgroundColor: theme.palette.primary.main,
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: compact ? 0 : 34,
            mr: compact ? 0 : 0.85,
            color: active ? "text.primary" : "text.secondary",
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

    if (!compact) return button;

    return (
      <Tooltip key={`${item.label}-tooltip`} title={item.label} placement="right">
        <Box>{button}</Box>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ minHeight: 12 }} />

      <List sx={{ px: compact ? 1 : 1.2, pt: 1.2, pb: 0.8, display: "grid", gap: 0.55 }}>
        <SectionTitle compact={compact}>OPERACIÓN</SectionTitle>
        {mainItems.map(renderItem)}
      </List>

      <Divider sx={{ mx: compact ? 1 : 1.2, my: 1 }} />

      <List sx={{ px: compact ? 1 : 1.2, pt: 0.4, pb: 1.2, display: "grid", gap: 0.55 }}>
        <SectionTitle compact={compact}>BITÁCORA</SectionTitle>
        {workLogItems.map(renderItem)}
      </List>

      <Box sx={{ mt: "auto", p: compact ? 1 : 1.8 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: compact ? "none" : "block" }}>
          Operación guiada
        </Typography>
      </Box>
    </Box>
  );
}

export function DashboardSidebar({ mobileOpen, onMobileClose, collapsed, onNavigate, isRouteActive, navItems }: DashboardSidebarProps) {
  const theme = useTheme();
  const drawerWidth = collapsed ? DASHBOARD_DRAWER_COLLAPSED_WIDTH : DASHBOARD_DRAWER_EXPANDED_WIDTH;

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DASHBOARD_DRAWER_EXPANDED_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <SidebarBody
          compact={false}
          mobile
          onCloseMobile={onMobileClose}
          navItems={navItems}
          isRouteActive={isRouteActive}
          onNavigate={onNavigate}
        />
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            overflowX: "hidden",
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
      >
        <Box sx={{ minHeight: 64 }} />
        <SidebarBody
          compact={collapsed}
          mobile={false}
          onCloseMobile={onMobileClose}
          navItems={navItems}
          isRouteActive={isRouteActive}
          onNavigate={onNavigate}
        />
      </Drawer>
    </Box>
  );
}
