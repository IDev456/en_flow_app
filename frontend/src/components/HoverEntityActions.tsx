import type { MouseEvent } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Button, Stack, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

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
          borderRadius: 1.25,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha(theme.palette.background.paper, 0.9)
              : alpha(theme.palette.background.paper, 0.94),
          border: "1px solid",
          borderColor: "divider",
          backdropFilter: "blur(5px)",
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
            startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ minWidth: 0, px: 1.05, py: 0.45, borderRadius: 1, gap: 0.45 }}
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
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ minWidth: 0, px: 1.05, py: 0.45, borderRadius: 1, gap: 0.45 }}
          >
            Eliminar
          </Button>
        )}
      </Stack>
    </Box>
  );
}
