import { Button, Typography } from "@mui/material";

type EmptyTriggerListProps = {
  filtered: boolean;
  onCreateNew?: () => void;
};

export function EmptyTriggerList({ filtered, onCreateNew }: EmptyTriggerListProps) {
  return (
    <div className="trigger-list-empty">
      {filtered ? (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Sin resultados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Probá limpiar el filtro o buscar con otro término.
          </Typography>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
