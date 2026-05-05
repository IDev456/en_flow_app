import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Card sx={{ maxWidth: 620, mx: "auto", mt: { xs: 4, md: 8 } }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="subtitle2" color="warning.light">
            Ruta no encontrada
          </Typography>
          <Typography variant="h3">La vista solicitada no existe</Typography>
          <Typography variant="body1" color="text.secondary">
            La URL actual no corresponde a ninguna pantalla operativa disponible dentro del flujo.
          </Typography>
          <Button component={RouterLink} to="/board" variant="contained">
            Volver a bandeja
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
