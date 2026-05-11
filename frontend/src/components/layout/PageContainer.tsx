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
    <Stack spacing={1.75}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs separator="›" aria-label="breadcrumb" sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.75 } }}>
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (item.to && !isLast) {
              return (
                <Link
                  key={`${item.label}-${index}`}
                  component={RouterLink}
                  underline="hover"
                  color="text.secondary"
                  to={item.to}
                  sx={{ typography: "caption" }}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <Typography key={`${item.label}-${index}`} color={isLast ? "text.primary" : "text.secondary"} variant="caption">
                {item.label}
              </Typography>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: "1.45rem", md: "1.65rem" }, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {actions && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.6 }}>
            {actions}
          </Stack>
        )}
      </Stack>

      {children}
    </Stack>
  );
}
