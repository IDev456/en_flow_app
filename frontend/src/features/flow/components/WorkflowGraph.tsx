import { useEffect, useRef } from "react";
import AttachmentRoundedIcon from "@mui/icons-material/AttachmentRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import type { Theme } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box,
  ButtonBase,
  Card,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import type { Step } from "../types";
import { formatDate, formatElapsedTime, getStatusTone, humanizeStatus } from "../utils";
import { StatusBadge } from "./StatusBadge";
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
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {step.ultimo_comentario_tipo === "imagen" ? "Imagen adjunta" : "Archivo adjunto"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step.ultimo_comentario_adjunto_nombre ?? "Adjunto reciente"}
          </Typography>
        </Box>
      </Stack>
    );
  }

  const fallbackText =
    step.ultimo_comentario?.trim() ||
    (step.orden === 1 && step.descripcion?.trim() ? step.descripcion.trim() : "Sin registros todavia");
  const hasComment = fallbackText !== "Sin registros todavia";

  return (
    <Typography
      variant="body1"
      sx={{ fontWeight: hasComment ? 600 : 400 }}
      color={hasComment ? "text.primary" : "text.secondary"}
    >
      {fallbackText}
    </Typography>
  );
}

function getMutedSurface(theme: Theme) {
  return alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.28 : 0.72);
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
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  onOpenTrigger,
}: WorkflowGraphProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const orderedSteps = [...steps].sort((left, right) => left.orden - right.orden);

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
        <Card
          variant="outlined"
          sx={{
            borderStyle: "dashed",
            cursor: "pointer",
            borderColor: alpha(theme.palette.info.main, 0.42),
            backgroundColor: alpha(theme.palette.info.main, 0.08),
            borderRadius: 2,
          }}
        >
          <ButtonBase onClick={onOpenTrigger} sx={{ p: 2.25, display: "block", textAlign: "left" }}>
            <Stack spacing={0.75}>
              <Chip
                label="REQUERIMIENTO"
                size="small"
                color="info"
                variant="outlined"
                sx={{ alignSelf: "flex-start", fontWeight: 700, letterSpacing: 0.6 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                Requerimiento
              </Typography>
              <Typography variant="h6">{triggerLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                Origen del flow operativo.
              </Typography>
            </Stack>
          </ButtonBase>
        </Card>

        <Box
          aria-hidden="true"
          sx={{
            width: 2,
            height: 24,
            alignSelf: { xs: "center", md: "flex-start" },
            ml: { md: "59px" },
            borderRadius: 999,
            background: `linear-gradient(180deg, ${alpha(theme.palette.info.main, 0.35)}, ${alpha(theme.palette.primary.main, 0.3)})`,
          }}
        />

        <Stack spacing={2}>
          {orderedSteps.map((step, index) => {
            const isSelected = selectedStepId === step.id;
            const lastCommentAt = step.ultimo_comentario_fecha;
            const lastCommentElapsed = formatElapsedTime(lastCommentAt);
            const stateElapsed = formatElapsedTime(step.fecha_estado_actual);
            const isLast = index === orderedSteps.length - 1;
            const isFirst = index === 0;
            const stateColors = getStepStateColors(theme, step.estado);
            const shouldExpand = isSelected || step.estado !== "completado";

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
                  variant="outlined"
                  sx={{
                    borderColor: isSelected ? "primary.main" : "divider",
                    boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : "none",
                    borderRadius: 2,
                  }}
                >
                  <ButtonBase
                    ref={isSelected ? selectedCardRef : null}
                    onClick={() => {
                      onSelectStep(step.id);
                      onOpenStep(step.id);
                    }}
                    sx={{ display: "block", width: "100%", textAlign: "left" }}
                  >
                    {shouldExpand ? (
                      <Box sx={{ p: 2.25 }}>
                        <Stack spacing={1.25}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ mt: 1 }}>
                                {step.nombre}
                              </Typography>
                            </Box>
                            <StatusBadge value={step.estado} />
                          </Stack>

                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mb: 0.75, letterSpacing: 0.75, textTransform: "uppercase" }}
                            >
                              Ultimo registro
                            </Typography>
                            <Box
                              sx={{
                                borderRadius: 1.5,
                                px: 1.25,
                                py: 1,
                                backgroundColor: getMutedSurface(theme),
                                border: "1px solid",
                                borderColor: alpha(theme.palette.divider, 0.85),
                              }}
                            >
                              {renderLatestStepMovement(step)}
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", gap: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {lastCommentAt ? `Fecha: ${formatDate(lastCommentAt)}` : "Fecha: sin registro"}
                              </Typography>
                              {lastCommentElapsed && (
                                <Typography variant="caption" color="text.secondary">
                                  {lastCommentElapsed}
                                </Typography>
                              )}
                              {stateElapsed && (
                                <Typography variant="caption" color="text.secondary">
                                  Estado actual: {stateElapsed}
                                </Typography>
                              )}
                            </Stack>
                            {step.estado === "esperando_respuesta" && step.expected_external_event && (
                              <Typography variant="caption" color="info.light" sx={{ display: "block", mt: 0.75 }}>
                                Dato esperado: {step.expected_external_event}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    ) : (
                      <Box sx={{ p: 1.75 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                          <Typography variant="h6">{step.nombre}</Typography>
                        </Stack>
                      </Box>
                    )}
                  </ButtonBase>
                </Card>
              </Box>
            );
          })}
        </Stack>

        <Box
          aria-hidden="true"
          sx={{
            width: 2,
            height: 24,
            alignSelf: { xs: "center", md: "flex-start" },
            ml: { md: "59px" },
            borderRadius: 999,
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.28)}, ${alpha(theme.palette.text.primary, 0.12)})`,
          }}
        />

        <Card
          variant="outlined"
          sx={{
            borderStyle: "dashed",
            borderColor: workflowClosed ? alpha(theme.palette.success.main, 0.52) : alpha(theme.palette.warning.main, 0.44),
            backgroundColor: workflowClosed ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.08),
            borderRadius: 2,
          }}
        >
          <Box sx={{ p: 2.25 }}>
            <Stack spacing={0.75}>
              <Chip
                label="CIERRE"
                size="small"
                color={workflowClosed ? "success" : "warning"}
                variant="outlined"
                sx={{ alignSelf: "flex-start", fontWeight: 700, letterSpacing: 0.6 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                Cierre
              </Typography>
              <Typography variant="h6">{workflowClosed ? "Flow finalizado" : "Cierre pendiente"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {workflowClosed ? "El flow ya quedó resuelto." : "El flow se cerrará cuando no queden tareas pendientes."}
              </Typography>
            </Stack>
          </Box>
        </Card>
      </Stack>
    </Box>
  );
}

function GitLogWorkflowGraph({
  triggerLabel,
  steps,
  workflowClosed,
  selectedStepId,
  onSelectStep,
  onOpenStep,
  onOpenTrigger,
}: WorkflowGraphProps) {
  const theme = useTheme();
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const orderedSteps = [...steps].sort((left, right) => left.orden - right.orden);

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
        <Card variant="outlined">
          <ButtonBase onClick={onOpenTrigger} sx={{ p: 2.25, display: "block", textAlign: "left" }}>
            <Stack spacing={0.75}>
              <Chip label="REQUERIMIENTO" size="small" color="info" variant="outlined" sx={{ alignSelf: "flex-start", fontWeight: 700 }} />
              <Typography variant="h6">{triggerLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                Origen del flow
              </Typography>
            </Stack>
          </ButtonBase>
        </Card>

        {orderedSteps.map((step) => {
          const isSelected = selectedStepId === step.id;
          const lastCommentAt = step.ultimo_comentario_fecha;
          const lastCommentElapsed = formatElapsedTime(lastCommentAt);
          const stateElapsed = formatElapsedTime(step.fecha_estado_actual);
          return (
            <Card
              key={step.id}
              variant="outlined"
              sx={{
                borderColor: isSelected ? "primary.main" : "divider",
                boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : "none",
                borderRadius: 2,
              }}
            >
              <ButtonBase
                ref={isSelected ? selectedRowRef : null}
                onClick={() => {
                  onSelectStep(step.id);
                  onOpenStep(step.id);
                }}
                sx={{ p: 2.25, display: "block", width: "100%", textAlign: "left" }}
              >
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Chip label={`T${step.orden.toString().padStart(2, "0")}`} size="small" variant="outlined" />
                      <Typography variant="h6">{step.nombre}</Typography>
                      <StatusBadge value={step.estado} />
                    </Stack>
                  </Stack>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, letterSpacing: 0.75, textTransform: "uppercase" }}>
                      Ultimo registro
                    </Typography>
                    <Box
                      sx={{
                        borderRadius: 1.5,
                        px: 1.25,
                        py: 1,
                        backgroundColor: getMutedSurface(theme),
                        border: "1px solid",
                        borderColor: alpha(theme.palette.divider, 0.85),
                      }}
                    >
                      {renderLatestStepMovement(step)}
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {lastCommentAt ? `Fecha: ${formatDate(lastCommentAt)}` : "Fecha: sin registro"}
                      </Typography>
                      {lastCommentElapsed && (
                        <Typography variant="caption" color="text.secondary">
                          {lastCommentElapsed}
                        </Typography>
                      )}
                      {stateElapsed && (
                        <Typography variant="caption" color="text.secondary">
                          Estado actual: {stateElapsed}
                        </Typography>
                      )}
                    </Stack>
                    {step.estado === "esperando_respuesta" && step.expected_external_event && (
                      <Typography variant="caption" color="info.light" sx={{ display: "block", mt: 0.75 }}>
                        Dato esperado: {step.expected_external_event}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </ButtonBase>
            </Card>
          );
        })}

        <Card
          variant="outlined"
          sx={{
            borderRadius: 2,
            borderStyle: "dashed",
            borderColor: workflowClosed ? alpha(theme.palette.success.main, 0.52) : alpha(theme.palette.warning.main, 0.44),
            backgroundColor: workflowClosed ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.08),
          }}
        >
          <Box sx={{ p: 2.25 }}>
            <Stack spacing={0.75}>
              <Chip
                label="CIERRE"
                size="small"
                color={workflowClosed ? "success" : "warning"}
                variant="outlined"
                sx={{ alignSelf: "flex-start", fontWeight: 700 }}
              />
              <Typography variant="h6">{workflowClosed ? "Flow finalizado" : "Cierre pendiente"}</Typography>
            </Stack>
          </Box>
        </Card>
      </Stack>
    </Box>
  );
}
