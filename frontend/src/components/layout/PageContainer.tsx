import type { ReactNode } from "react";
import { Box, Breadcrumbs, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

type PageBreadcrumb = {
  label: string;
  to?: string;
};

type PageContainerProps = {
  breadcrumbs?: PageBreadcrumb[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageContainer({ breadcrumbs = [], title, subtitle, actions, children }: PageContainerProps) {
  return (
    <Stack spacing={2.25}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs separator="›" aria-label="breadcrumb">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (item.to && !isLast) {
              return (
                <Link key={`${item.label}-${index}`} component={RouterLink} underline="hover" color="inherit" to={item.to}>
                  {item.label}
                </Link>
              );
            }

            return (
              <Typography key={`${item.label}-${index}`} color={isLast ? "text.primary" : "text.secondary"}>
                {item.label}
              </Typography>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Box>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.55rem", md: "1.85rem" } }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {actions && <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.6 }}>{actions}</Stack>}
      </Stack>

      {children}
    </Stack>
  );
}
