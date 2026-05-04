import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { Step, StepComment, StepHistoryEntry, StepJournalEntryInput } from "../types";
import { formatDate } from "../utils";
import { Journal } from "./Journal";
import { StatusBadge } from "./StatusBadge";

type StepDetailPanelProps = {
  workflowId: string;
  step: Step | null;
  comments: StepComment[];
  history: StepHistoryEntry[];
  standalone?: boolean;
  drawer?: boolean;
  onClose?: () => void;
  error?: string | null;
  onSubmitJournal: (input: StepJournalEntryInput) => Promise<void>;
};

export function StepDetailPanel({
  workflowId,
  step,
  comments,
  history,
  standalone = false,
  drawer = false,
  onClose,
  error,
  onSubmitJournal,
}: StepDetailPanelProps) {
  const [selectedStatus, setSelectedStatus] = useState<"" | "espera" | "problema" | "completado">("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [focusRequestToken, setFocusRequestToken] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!step) {
      return;
    }
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
  }, [step?.id]);

  if (!step) {
    return (
      <Card
        sx={{
          ...(drawer
            ? { position: { xl: "sticky" }, top: { xl: 96 } }
            : {}),
          ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={1}>
              <Typography variant="h5">Sin paso seleccionado</Typography>
              <Typography color="text.secondary">
                Selecciona un paso del flujo para revisar su bitacora, entender el contexto y registrar avance.
              </Typography>
            </Stack>
        </CardContent>
      </Card>
    );
  }

  const canChangeStatus = ["activo", "espera", "problema"].includes(step.estado);

  async function handleSubmitJournal(input: StepJournalEntryInput) {
    await onSubmitJournal(input);
    setSelectedStatus("");
    setComposerExpanded(false);
    setMenuAnchor(null);
  }

  function handleStatusIntent(status: "" | "espera" | "problema" | "completado") {
    setSelectedStatus(status);
    setComposerExpanded(true);
    setMenuAnchor(null);
    setFocusRequestToken((value) => value + 1);
  }

  return (
    <Card
      sx={{
        minWidth: 0,
        ...(drawer
          ? { position: { xl: "sticky" }, top: { xl: 96 } }
          : {}),
        ...(standalone ? { maxWidth: 980, mx: "auto" } : {}),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box>
                <Typography variant="overline" color="primary.light">
                  Paso {step.orden}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.25 }}>
                  {step.nombre}
                </Typography>
                {step.descripcion && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {step.descripcion}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                <StatusBadge value={step.estado} />
                {canChangeStatus && (
                  <>
                    <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)} aria-label="Cambiar estado">
                      <MoreHorizRoundedIcon />
                    </IconButton>
                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                      <MenuItem onClick={() => handleStatusIntent("espera")}>Marcar en espera</MenuItem>
                      <MenuItem onClick={() => handleStatusIntent("problema")}>Marcar con problema</MenuItem>
                      <MenuItem onClick={() => handleStatusIntent("completado")}>Completar paso</MenuItem>
                    </Menu>
                  </>
                )}
                {drawer && onClose && (
                  <IconButton onClick={onClose} aria-label="Cerrar detalle del paso">
                    <CloseRoundedIcon />
                  </IconButton>
                )}
              </Stack>
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Tipo: {step.tipo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Responsable: {step.asignado_a || "Sin asignar"}
              </Typography>
              {step.fecha_inicio && (
                <Typography variant="body2" color="text.secondary">
                  Inicio: {formatDate(step.fecha_inicio)}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ pt: 0.5 }}>
                Aqui puedes dejar evidencia, explicar bloqueos o completar el paso cuando ya este resuelto.
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Journal
            step={step}
            comments={comments}
            history={history}
            canChangeStatus={canChangeStatus}
            selectedStatus={selectedStatus}
            onSelectedStatusChange={setSelectedStatus}
            composerExpanded={composerExpanded}
            onComposerExpandedChange={setComposerExpanded}
            focusRequestToken={focusRequestToken}
            onSubmitEntry={handleSubmitJournal}
          />
        </Box>

        {error && (
          <>
            <Divider />
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          </>
        )}

        {standalone && (
          <>
            <Divider />
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2.25 }}>
              <Button component={RouterLink} to={`/workflows/${workflowId}`} variant="text" color="inherit">
                Volver al workflow
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
