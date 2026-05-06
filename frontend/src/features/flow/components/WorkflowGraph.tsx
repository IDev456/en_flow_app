import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AttachmentRoundedIcon from "@mui/icons-material/AttachmentRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
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

function renderLatestStepMovement(step: Step) {
  if (step.ultimo_comentario_tipo === "imagen" || step.ultimo_comentario_tipo === "adjunto") {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        {step.ultimo_comentario_tipo === "imagen" ? <ImageRoundedIcon color="info" /> : <AttachmentRoundedIcon color="info" />}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {step.ultimo_comentario_tipo === "imagen" ? "Imagen adjunta" : "Archivo adjunto"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {step.ultimo_comentario_adjunto_nombre ?? "Adjunto reciente"}
          </Typography>
        </Box>
      </Stack>
    );
  }

  const title = step.nombre?.trim();
  const lastComment = step.ultimo_comentario?.trim();
  const description = step.descripcion?.trim();
  const normalizedTitle = title?.toLowerCase();

  const getValidSecondaryText = (text: string | undefined | null): string | null => {
    if (!text) return null;
    const normalizedText = text.toLowerCase();
    if (normalizedText === normalizedTitle) return null;
    if (normalizedTitle && normalizedText.includes(normalizedTitle)) return null;
    return text;
  };

  const fallbackText =
    getValidSecondaryText(lastComment) ||
    getValidSecondaryText(description) ||
    "Sin registros todavía";
  const hasComment = fallbackText !== "Sin registros todavía";

  return (
    <Typography variant="body2" sx={{ fontWeight: hasComment ? 600 : 400, lineHeight: 1.45 }} color={hasComment ? "text.primary" : "text.secondary"}>
      {fallbackText}
    </Typography>
  );
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
  if (createdElapsed) parts.push(`Creada hace ${createdElapsed}`);
  if (stateElapsed) parts.push(`Estado hace ${stateElapsed}`);
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

function getRecordMetaParts(lastCommentAt: string | null, lastCommentElapsed: string | null, stateElapsed: string | null) {
  const parts: string[] = [];

  if (lastCommentAt) {
    parts.push(formatDate(lastCommentAt));
  }

  if (lastCommentElapsed) {
    parts.push(lastCommentElapsed);
  } else if (!lastCommentAt && stateElapsed) {
    parts.push(`Estado actual: ${stateElapsed}`);
  }

  return parts;
}

function getStepStateColors(theme: Theme, status: Step["estado"]) {
  const tone = getStatusTone(status);

  if (tone === "completado" || tone === "finalizado" || tone === "resuelto") {
    return {
      borderColor: alpha(theme.palette.success.main, 0.48),
      backgroundColor: alpha(theme.palette.success.main, 0.16),
      textColor: theme.palette.success.light,
      lineColor: alpha(theme.palette.success.main, 0.36),
    };
  }

  if (tone === "espera") {
    return {
      borderColor: alpha(theme.palette.warning.main, 0.48),
      backgroundColor: alpha(theme.palette.warning.main, 0.16),
      textColor: theme.palette.warning.light,
      lineColor: alpha(theme.palette.warning.main, 0.34),
    };
  }

  if (tone === "espera_externa") {
    return {
      borderColor: alpha(theme.palette.info.main, 0.52),
      backgroundColor: alpha(theme.palette.info.main, 0.18),
      textColor: theme.palette.info.light,
      lineColor: alpha(theme.palette.info.main, 0.4),
    };
  }

  if (tone === "cancelado" || tone === "error" || tone === "problema") {
    return {
      borderColor: alpha(theme.palette.error.main, 0.5),
      backgroundColor: alpha(theme.palette.error.main, 0.16),
      textColor: theme.palette.error.light,
      lineColor: alpha(theme.palette.error.main, 0.34),
    };
  }

  return {
    borderColor: alpha(theme.palette.primary.main, 0.5),
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
    textColor: theme.palette.primary.light,
    lineColor: alpha(theme.palette.primary.main, 0.34),
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
      <Stack spacing={2.5}>
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

        <Stack spacing={2}>
          {orderedSteps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const lastCommentAt = step.ultimo_comentario_fecha;
            const lastCommentElapsed = formatElapsedTime(lastCommentAt);
            const stateElapsed = formatElapsedTime(step.fecha_estado_actual);
            const recordMetaParts = getRecordMetaParts(lastCommentAt, lastCommentElapsed, stateElapsed);
            const isFirst = index === 0;
            const isLast = index === orderedSteps.length - 1;
            const stateColors = getStepStateColors(theme, step.estado);
            const shouldExpand = isSelected || step.estado !== "completado";
            const canComplete = ["activo", "espera", "problema"].includes(step.estado);

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
                      width: 96,
                      height: 96,
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
                  <Box sx={{ p: 2.25 }}>
                    <Stack spacing={1.25}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ mt: 1 }}>
                            {step.nombre}
                          </Typography>
                        </Box>
                      </Stack>

                      {renderStepTiming(step)}

                      {shouldExpand ? (
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
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 0.45, opacity: 0.82 }}
                            >
                              Último registro
                            </Typography>
                            <Box
                              sx={{
                                borderRadius: 1.25,
                                px: 1,
                                py: 0.8,
                                backgroundColor: getMutedSurface(theme),
                                borderLeft: "2px solid",
                                borderLeftColor: alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.42 : 0.72),
                                transition: "background-color 180ms ease, border-color 180ms ease",
                                ".MuiButtonBase-root:hover &, .MuiButtonBase-root:focus-visible &": {
                                  backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.22 : 0.62),
                                  borderLeftColor: alpha(theme.palette.primary.main, 0.38),
                                },
                              }}
                            >
                              {renderLatestStepMovement(step)}
                            </Box>
                            {recordMetaParts.length > 0 && (
                              <Stack direction="row" spacing={0.75} sx={{ mt: 0.45, flexWrap: "wrap", gap: 0.75 }}>
                                {recordMetaParts.map((part) => (
                                  <Typography key={`${step.id}-${part}`} variant="caption" color="text.secondary" sx={{ opacity: 0.76 }}>
                                    {part}
                                  </Typography>
                                ))}
                              </Stack>
                            )}
                            {step.estado === "esperando_respuesta" && step.expected_external_event && (
                              <Typography variant="caption" color="info.light" sx={{ display: "block", mt: 0.45, opacity: 0.9 }}>
                                Dato esperado: {step.expected_external_event}
                              </Typography>
                            )}
                          </Box>
                        </ButtonBase>
                      ) : null}
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
          const lastCommentAt = step.ultimo_comentario_fecha;
          const lastCommentElapsed = formatElapsedTime(lastCommentAt);
          const stateElapsed = formatElapsedTime(step.fecha_estado_actual);
          const recordMetaParts = getRecordMetaParts(lastCommentAt, lastCommentElapsed, stateElapsed);
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
              <Box sx={{ p: 2.25 }}>
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Chip label={`T${step.orden.toString().padStart(2, "0")}`} size="small" variant="outlined" />
                      <Typography variant="h6">{step.nombre}</Typography>
                    </Stack>
                  </Stack>
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
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.45, opacity: 0.82 }}>
                        Último registro
                      </Typography>
                      <Box
                        sx={{
                          borderRadius: 1.25,
                          px: 1,
                          py: 0.8,
                          backgroundColor: getMutedSurface(theme),
                          borderLeft: "2px solid",
                          borderLeftColor: alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.42 : 0.72),
                          transition: "background-color 180ms ease, border-color 180ms ease",
                          ".MuiButtonBase-root:hover &, .MuiButtonBase-root:focus-visible &": {
                            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.22 : 0.62),
                            borderLeftColor: alpha(theme.palette.primary.main, 0.38),
                          },
                        }}
                      >
                        {renderLatestStepMovement(step)}
                      </Box>
                      {recordMetaParts.length > 0 && (
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.45, flexWrap: "wrap", gap: 0.75 }}>
                          {recordMetaParts.map((part) => (
                            <Typography key={`${step.id}-${part}`} variant="caption" color="text.secondary" sx={{ opacity: 0.76 }}>
                              {part}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                      {step.estado === "esperando_respuesta" && step.expected_external_event && (
                        <Typography variant="caption" color="info.light" sx={{ display: "block", mt: 0.45, opacity: 0.9 }}>
                          Dato esperado: {step.expected_external_event}
                        </Typography>
                      )}
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
