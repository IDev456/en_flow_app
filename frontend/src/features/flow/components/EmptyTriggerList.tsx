import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

type EmptyTriggerListProps = {
  filtered: boolean;
  onCreateNew?: () => void;
};

export function EmptyTriggerList({ filtered, onCreateNew }: EmptyTriggerListProps) {
  return (
    <Box
      className="trigger-list-empty"
      sx={{
        p: { xs: 1.6, md: 1.9 },
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.background.paper, 0.35)
            : alpha(theme.palette.background.paper, 0.7),
      }}
    >
      {filtered ? (
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" color="text.secondary">
            Sin resultados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Probá limpiar el filtro o buscar con otro término.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" color="text.secondary">
            No hay requerimientos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Creá el primer requerimiento para agrupar y dar seguimiento al trabajo.
          </Typography>
          {onCreateNew && (
            <Button variant="outlined" color="inherit" size="small" onClick={onCreateNew}>
              Nuevo requerimiento
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
