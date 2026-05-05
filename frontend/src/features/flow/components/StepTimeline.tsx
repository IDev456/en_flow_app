import type { ReactNode } from "react";
import { Card, CardContent, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { Step } from "../types";
import { formatDate } from "../utils";
import { StatusBadge } from "./StatusBadge";

type StepTimelineProps = {
  steps: Step[];
};

export function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <Stack spacing={1.5}>
      {steps.map((step) => (
        <Card key={step.id} variant="outlined" sx={{ borderColor: step.estado === "activo" ? "primary.main" : "divider" }}>
          <CardContent sx={{ display: "grid", gap: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <BoxBlock>
                <Typography variant="subtitle2" color="text.secondary">
                  Tarea {step.orden}
                </Typography>
                <Typography variant="h6">{step.nombre}</Typography>
              </BoxBlock>
              <StatusBadge value={step.estado} />
            </Stack>
            {step.descripcion && (
              <Typography variant="body2" color="text.secondary">
                {step.descripcion}
              </Typography>
            )}
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Tipo: {step.tipo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Inicio: {formatDate(step.fecha_inicio)}
              </Typography>
            </Stack>
            <Link component={RouterLink} to={`/steps/${step.id}`} underline="hover">
              Ver detalle de la tarea
            </Link>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function BoxBlock({ children }: { children: ReactNode }) {
  return <Stack spacing={0.5}>{children}</Stack>;
}
