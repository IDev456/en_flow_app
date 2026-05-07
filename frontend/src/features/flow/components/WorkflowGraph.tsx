import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Button, ButtonBase, Card, Chip, Stack, Typography } from "@mui/material";

import type { Step } from "../types";
import { formatDate, formatElapsedTime, getStatusTone, humanizeStatus } from "../utils";
import type { WorkflowVariant } from "./WorkflowVariantSwitcher";

type WorkflowGraphProps = {
  variant: WorkflowVariant;
  triggerLabel: string;
  steps: Step[];
  workflowClosed: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onOpenStep: (stepId: string) => void;
  onOpenTrigger: () => void;
  onCompleteStepIntent?: (stepId: string) => void;
};

export function WorkflowGraph(props: WorkflowGraphProps) {
  if (props.variant === "gitlog") {
    return <GitLogWorkflowGraph {...props} />;
  }

  return <VerticalWorkflowGraph {...props} />;
}

function formatExpectedExternalEventLabel(expected?: string | null): string | null {
  const trimmed = expected?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("esperando") ? trimmed : `Esperando ${trimmed}`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return "menos de 1 min";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function formatDurationBetween(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  return formatDuration(ms);
}

function renderStepTiming(step: Step): React.ReactElement | null {
  const createdElapsed = step.fecha_creacion ? formatElapsedTime(step.fecha_creacion) : null;
  const stateElapsed = step.fecha_estado_actual ? formatElapsedTime(step.fecha_estado_actual) : null;
  const durationEnd = step.fecha_cierre ?? step.fecha_estado_actual;
  const duration = formatDurationBetween(step.fecha_creacion, durationEnd);

  const parts: string[] = [];
  if (createdElapsed) parts.push(`Creada ${createdElapsed}`);
  if (stateElapsed) parts.push(`Estado ${stateElapsed}`);
  if (duration) parts.push(`Duración ${duration}`);

  if (parts.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
      <AccessTimeRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary">
        {parts.join(" · ")}
      </Typography>
    </Stack>
  );
}

function getMutedSurface(theme: Theme) {
  return alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.16 : 0.52);
}

function getStepStateColors(theme: Theme, status: Step["estado"]) {
  const tone = getStatusTone(status);

  if (tone === "completado" || tone === "finalizado" || tone === "resuelto") {
    return {
      borderColor: alpha(theme.palette.success.main, 0.68),
      backgroundColor: alpha(theme.palette.success.main, 0.24),
      textColor: theme.palette.success.dark,
      lineColor: alpha(theme.palette.success.main, 0.64),
    };
  }

  if (tone === "espera") {
    return {
      borderColor: alpha(theme.palette.warning.main, 0.72),
      backgroundColor: alpha(theme.palette.warning.main, 0.24),
      textColor: theme.palette.warning.dark,
      lineColor: alpha(theme.palette.warning.main, 0.68),
    };
  }

  if (tone === "espera_externa") {
    return {
      borderColor: alpha(theme.palette.warning.main, 0.72),
      backgroundColor: alpha(theme.palette.warning.main, 0.24),
      textColor: theme.palette.warning.dark,
      lineColor: alpha(theme.palette.warning.main, 0.68),
    };
  }

  if (tone === "cancelado") {
    return {
      borderColor: alpha(theme.palette.text.secondary, 0.46),
      backgroundColor: alpha(theme.palette.text.secondary, 0.12),
      textColor: theme.palette.text.secondary,
      lineColor: alpha(theme.palette.text.secondary, 0.32),
    };
  }

  if (tone === "error" || tone === "problema") {
    return {
      borderColor: alpha(theme.palette.error.main, 0.72),
      backgroundColor: alpha(theme.palette.error.main, 0.22),
      textColor: theme.palette.error.dark,
      lineColor: alpha(theme.palette.error.main, 0.68),
    };
  }

  return {
    borderColor: alpha(theme.palette.primary.main, 0.72),
    backgroundColor: alpha(theme.palette.primary.main, 0.22),
    textColor: theme.palette.primary.main,
    lineColor: alpha(theme.palette.primary.main, 0.68),
  };
}

function VerticalWorkflowGraph({
  steps,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  onCompleteStepIntent,
}: WorkflowGraphProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);

  useEffect(() => {
    if (!viewportRef.current || !selectedCardRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const card = selectedCardRef.current;
    viewport.scrollTo({
      top: Math.max(0, card.offsetTop - 120),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <Box ref={viewportRef} sx={{ maxHeight: "72vh", overflow: "auto", pr: 0.5 }}>
      <Stack spacing={2}>
        {orderedSteps.length > 0 && (
          <Box
            aria-hidden="true"
            sx={{
              width: 2,
              height: 24,
              alignSelf: { xs: "center", md: "flex-start" },
              ml: { md: "59px" },
              borderRadius: 999,
              background: `linear-gradient(180deg, ${alpha(theme.palette.warning.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.3)})`,
            }}
          />
        )}

        <Stack spacing={1.5}>
          {orderedSteps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const stateColors = getStepStateColors(theme, step.estado);
            const isFirst = index === 0;
            const isLast = index === orderedSteps.length - 1;
            const canComplete = ["activo", "espera", "problema", "esperando_respuesta"].includes(step.estado);
            const hasRecords = Boolean(step.ultimo_comentario_fecha || step.ultimo_comentario || step.resultado || step.observaciones);

            return (
              <Box
                key={step.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "120px minmax(0, 1fr)" },
                  gap: 2,
                  alignItems: "stretch",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "relative",
                    py: { xs: 0.5, md: 0.75 },
                  }}
                >
                  {!isFirst && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: { xs: -22, md: -26 },
                        height: { xs: 24, md: 28 },
                        width: 2,
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${alpha(theme.palette.text.primary, 0.08)}, ${stateColors.lineColor})`,
                      }}
                    />
                  )}
                  {!isLast && (
                    <Box
                      sx={{
                        position: "absolute",
                        bottom: { xs: -22, md: -26 },
                        height: { xs: 24, md: 28 },
                        width: 2,
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${stateColors.lineColor}, ${alpha(theme.palette.text.primary, 0.08)})`,
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      px: 1,
                      textAlign: "center",
                      border: "1.5px solid",
                      borderColor: stateColors.borderColor,
                      backgroundColor: stateColors.backgroundColor,
                      boxShadow: isSelected ? `0 0 0 3px ${alpha(stateColors.textColor, 0.12)}` : "none",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1, color: stateColors.textColor }}>
                      Tarea {step.orden}
                    </Typography>
                    <Typography variant="caption" sx={{ mt: 0.5, px: 1, color: stateColors.textColor }}>
                      {humanizeStatus(step.estado)}
                    </Typography>
                  </Box>
                </Box>

                <Card
                  ref={isSelected ? selectedCardRef : null}
                  variant="outlined"
                  sx={{
                    position: "relative",
                    borderColor: isSelected ? "primary.main" : "divider",
                    boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : "none",
                    borderRadius: 2,
                    transition: "box-shadow 180ms ease",
                    "&:hover .complete-step-button, &:focus-within .complete-step-button": {
                      opacity: 1,
                      visibility: "visible",
                    },
                  }}
                >
                  {canComplete && onCompleteStepIntent ? (
                    <Button
                      className="complete-step-button"
                      size="small"
                      variant="contained"
                      onClick={(event: MouseEvent<HTMLButtonElement>) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onCompleteStepIntent(step.id);
                      }}
                      onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()}
                      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
                      aria-label={`Completar tarea ${step.nombre}`}
                      sx={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        opacity: 0,
                        visibility: "hidden",
                        transition: "opacity 180ms ease",
                        textTransform: "none",
                        zIndex: 1,
                      }}
                    >
                      Listo
                    </Button>
                  ) : null}
                  <Box sx={{ p: 1.5 }}>
                    <Stack spacing={0.95}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ mt: 1 }}>
                            {step.nombre}
                          </Typography>
                        </Box>
                      </Stack>

                      {renderStepTiming(step)}

                      <ButtonBase
                        onClick={() => {
                          onSelectStep(step.id);
                          onOpenStep(step.id);
                        }}
                        aria-label={`Ver registro de la tarea ${step.nombre}`}
                        sx={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          borderRadius: 1.5,
                          px: 0,
                          py: 0,
                          cursor: "pointer",
                          transition: "background-color 180ms ease",
                          "&:hover": {
                            backgroundColor: alpha(theme.palette.action.hover, 0.05),
                          },
                          "&:focus-visible": {
                            outline: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                            outlineOffset: "2px",
                          },
                        }}
                      >
                        <Box sx={{ px: 0.25, py: 0.25 }}>
                          <Typography variant="caption" color="text.secondary">
                            {hasRecords ? "Con registros" : "Sin registros todavía"}
                          </Typography>
                        </Box>
                      </ButtonBase>
                    </Stack>
                  </Box>
                </Card>
              </Box>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}

function GitLogWorkflowGraph({
  steps,
  selectedStepId,
  onSelectStep,
  onOpenStep,
}: WorkflowGraphProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const orderedSteps = [...steps].sort((left, right) => right.orden - left.orden);

  useEffect(() => {
    if (!viewportRef.current || !selectedRowRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const row = selectedRowRef.current;
    viewport.scrollTo({
      top: Math.max(0, row.offsetTop - 90),
      behavior: "smooth",
    });
  }, [selectedStepId, steps.length]);

  return (
    <Box ref={viewportRef} sx={{ maxHeight: "72vh", overflow: "auto", pr: 0.5 }}>
      <Stack spacing={1.5}>
        {orderedSteps.map((step) => {
          const isSelected = selectedStepId === step.id;
          const hasRecords = Boolean(step.ultimo_comentario_fecha || step.ultimo_comentario || step.resultado || step.observaciones);
          return (
            <Card
              key={step.id}
              ref={isSelected ? selectedRowRef : null}
              variant="outlined"
              sx={{
                borderColor: isSelected ? "primary.main" : "divider",
                boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : "none",
                borderRadius: 2,
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Stack spacing={0.9}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Chip label={`T${step.orden.toString().padStart(2, "0")}`} size="small" variant="outlined" />
                      <Typography variant="h6">{step.nombre}</Typography>
                    </Stack>
                  </Stack>
                  {renderStepTiming(step)}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 24 }}>
                    <Typography variant="caption" color="text.secondary">
                      {hasRecords ? "Con registros" : "Sin registros todavía"}
                    </Typography>
                  </Box>
                  <ButtonBase
                    onClick={() => {
                      onSelectStep(step.id);
                      onOpenStep(step.id);
                    }}
                    aria-label={`Ver registro de la tarea ${step.nombre}`}
                    sx={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      borderRadius: 1.5,
                      px: 0,
                      py: 0,
                      cursor: "pointer",
                      transition: "background-color 180ms ease",
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.action.hover, 0.05),
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                        outlineOffset: "2px",
                      },
                    }}
                  >
                    <Box sx={{ px: 0.25, py: 0.25 }}>
                      <Typography variant="caption" color="text.secondary">
                        Ver registros
                      </Typography>
                    </Box>
                  </ButtonBase>
                </Stack>
              </Box>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
