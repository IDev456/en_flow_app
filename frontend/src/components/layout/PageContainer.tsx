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
    <Stack spacing={2}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator=">"
          aria-label="breadcrumb"
          sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.75, color: "text.disabled" } }}
        >
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
        spacing={1.25}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: "1.28rem", md: "1.5rem" }, lineHeight: 1.12 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, display: "block", maxWidth: 820 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {actions && (
          <Stack
            direction="row"
            spacing={0.85}
            sx={{
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 0.7,
              alignSelf: { xs: "stretch", sm: "center" },
            }}
          >
            {actions}
          </Stack>
        )}
      </Stack>

      {children}
    </Stack>
  );
}
