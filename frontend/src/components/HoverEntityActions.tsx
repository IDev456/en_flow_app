import type { MouseEvent } from "react";
import { Box, Button, Stack, type SxProps, type Theme } from "@mui/material";

type HoverEntityActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  sx?: SxProps<Theme>;
};

function stopEvent(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export function HoverEntityActions({ onEdit, onDelete, sx }: HoverEntityActionsProps) {
  if (!onEdit && !onDelete) {
    return null;
  }

  return (
    <Box
      className="hover-entity-actions"
      sx={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 3,
        opacity: 0,
        transform: "translateY(-2px)",
        pointerEvents: "none",
        transition: "opacity 140ms ease, transform 140ms ease",
        ".hover-entity-parent:hover &, .hover-entity-parent:focus-within &": {
          opacity: 1,
          transform: "translateY(0)",
          pointerEvents: "auto",
        },
        ...sx,
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          p: 0.5,
          borderRadius: 1.5,
          backgroundColor: "rgba(8, 14, 26, 0.86)",
          border: "1px solid",
          borderColor: "divider",
          backdropFilter: "blur(6px)",
        }}
      >
        {onEdit && (
          <Button
            size="small"
            variant="text"
            color="inherit"
            onMouseDown={stopEvent}
            onClick={(event) => {
              stopEvent(event);
              onEdit();
            }}
            sx={{ minWidth: 0, px: 1.15, py: 0.5, borderRadius: 1.25 }}
          >
            Editar
          </Button>
        )}
        {onDelete && (
          <Button
            size="small"
            variant="text"
            color="error"
            onMouseDown={stopEvent}
            onClick={(event) => {
              stopEvent(event);
              onDelete();
            }}
            sx={{ minWidth: 0, px: 1.15, py: 0.5, borderRadius: 1.25 }}
          >
            Eliminar
          </Button>
        )}
      </Stack>
    </Box>
  );
}
