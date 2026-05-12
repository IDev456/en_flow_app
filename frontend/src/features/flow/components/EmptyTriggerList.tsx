import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

type EmptyTriggerListProps = {
  filtered: boolean;
  onCreateNew?: () => void;
};

export function EmptyTriggerList({ filtered, onCreateNew }: EmptyTriggerListProps) {
  return (
    <Box
      className="trigger-list-empty"
      sx={{
        p: { xs: 2, md: 2.25 },
        borderRadius: 2.2,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.background.paper, 0.3)
            : alpha(theme.palette.background.paper, 0.8),
      }}
    >
      {filtered ? (
        <Stack spacing={0.6} sx={{ alignItems: "center" }}>
          <InboxRoundedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <Typography variant="subtitle2" color="text.secondary">
            Sin resultados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Probá limpiar el filtro o buscar con otro término.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={0.8} sx={{ alignItems: "center" }}>
          <InboxRoundedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <Typography variant="subtitle2" color="text.secondary">
            No hay proyectos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Creá el primer proyecto para agrupar y dar seguimiento al trabajo.
          </Typography>
          {onCreateNew && (
            <Button variant="outlined" color="inherit" size="small" onClick={onCreateNew}>
              Nuevo proyecto
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
