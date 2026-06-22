import type { ChangeEvent, ClipboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";

import { useToastContext } from "../../../components/Toast";
import { getWorkflow, listTriggers, listWorkflows, quickCaptureFlow, startWorkflow } from "../api";
import { navigateWithOrigin } from "../navigation";
import { AttachmentDraftGrid } from "./AttachmentDraftGrid";
import { ReminderDateField } from "./ReminderDateField";
import { AmbitoChip } from "./AmbitoChip";
import { DuplicateFlowWarningDialog } from "./DuplicateFlowWarningDialog";
import { LiveDuplicateSuggestions } from "./LiveDuplicateSuggestions";
import type {
  Ambito,
  QuickCaptureInput,
  TriggerDetail,
  WorkflowDetail,
  WorkflowStartInput,
  WorkflowStartMode,
} from "../types";
import {
  DEFAULT_ACTOR,
  getAmbitoLabel,
  getReminderDateError,
  getStoredActiveAmbito,
  getTodayLocalDateInput,
  toCalendarDateUtcIso,
} from "../utils";
import {
  buildRequirementByWorkflowId,
  findSimilarFlows,
  getSignificantTokens,
  isOperationalWorkflowStatus,
  normalizeText,
  type DuplicateCandidate,
  type RequirementByWorkflowId,
} from "../utils/duplicateDetection";
import {
  extractImageFilesFromClipboardData,
  readFilesAsLocalAttachments,
  type LocalAttachmentDraft,
} from "../utils/attachments";

type TriggerCreateModalProps = {
  onClose: () => void;
  defaultRequirementId?: string;
  defaultRequirementLabel?: string;
};

type DuplicateCatalog = {
  workflowsById: Record<string, WorkflowDetail>;
  requirementByWorkflowId: RequirementByWorkflowId;
  triggersById: Record<string, TriggerDetail>;
};

type PendingCreation =
  | {
      kind: "quick";
      payload: QuickCaptureInput;
    }
  | {
      kind: "linked";
      requirementId: string;
      requirementLabel: string | null;
      payload: WorkflowStartInput;
    };

export function TriggerCreateModal({ onClose, defaultRequirementId, defaultRequirementLabel }: TriggerCreateModalProps) {
  const theme = useTheme();
  const [captureMode, setCaptureMode] = useState<WorkflowStartMode>("tarea_activa");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignee, setAssignee] = useState("");
  const [executionDate, setExecutionDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [waitingWhat, setWaitingWhat] = useState("");
  const [waitingFrom, setWaitingFrom] = useState("");
  const [waitingReference, setWaitingReference] = useState("");
  const [waitingFollowUpDate, setWaitingFollowUpDate] = useState("");
  const [initialRecordComment, setInitialRecordComment] = useState("");
  const [initialRecordAttachments, setInitialRecordAttachments] = useState<LocalAttachmentDraft[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [availableRequirements, setAvailableRequirements] = useState<TriggerDetail[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [checkingLiveDuplicates, setCheckingLiveDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [ambito, setAmbito] = useState<Exclude<Ambito, null>>(() => getStoredActiveAmbito());
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [liveDuplicateCandidates, setLiveDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [pendingCreation, setPendingCreation] = useState<PendingCreation | null>(null);
  const [linkedRequirementAmbito, setLinkedRequirementAmbito] = useState<Ambito>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const duplicateCatalogRef = useRef<DuplicateCatalog | null>(null);
  const liveRequestIdRef = useRef(0);
  const primaryInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const linkedRequirementLabel = defaultRequirementLabel?.trim() || null;
  const selectedRequirement =
    !defaultRequirementId && selectedRequirementId
      ? availableRequirements.find((requirement) => requirement.id === selectedRequirementId) ?? null
      : null;
  const effectiveRequirementId = defaultRequirementId ?? selectedRequirement?.id ?? null;
  const effectiveRequirementLabel = linkedRequirementLabel ?? selectedRequirement?.descripcion?.trim() ?? null;
  const effectiveRequirementAmbito = defaultRequirementId ? linkedRequirementAmbito : (selectedRequirement?.ambito ?? null);
  const isLinkedCapture = Boolean(effectiveRequirementId);
  const canSubmit =
    captureMode === "tarea_activa" ? title.trim().length >= 3 : waitingWhat.trim().length >= 3;

  function getOriginLocationWithoutModal() {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("modal");
    nextParams.delete("requirementId");
    nextParams.delete("requirementLabel");

    return {
      pathname: location.pathname,
      search: nextParams.toString() ? `?${nextParams.toString()}` : "",
      state: location.state,
    };
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      primaryInputRef.current?.focus();
    }, 40);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [captureMode]);

  useEffect(() => {
    if (defaultRequirementId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoadingRequirements(true);
        const requirements = await listTriggers();
        if (cancelled) return;
        setAvailableRequirements(requirements);
      } catch (err) {
        if (cancelled) return;
        console.warn("No se pudieron cargar los proyectos para la captura rapida.", err);
        setAvailableRequirements([]);
      } finally {
        if (!cancelled) {
          setLoadingRequirements(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultRequirementId]);

  useEffect(() => {
    if (defaultRequirementId || !selectedRequirementId) {
      return;
    }

    const selected = availableRequirements.find((requirement) => requirement.id === selectedRequirementId);
    if (!selected || selected.ambito !== ambito) {
      setSelectedRequirementId("");
    }
  }, [ambito, availableRequirements, defaultRequirementId, selectedRequirementId]);

  useEffect(() => {
    if (!defaultRequirementId) {
      setLinkedRequirementAmbito(null);
      return;
    }

    void loadDuplicateCatalog()
      .then((catalog) => {
        setLinkedRequirementAmbito(catalog.triggersById[defaultRequirementId]?.ambito ?? null);
      })
      .catch(() => {
        setLinkedRequirementAmbito(null);
      });
  }, [defaultRequirementId]);

  function hasDraft() {
    return Boolean(
      title.trim() ||
        detail.trim() ||
        assignee.trim() ||
        executionDate ||
        reminderDate ||
        waitingWhat.trim() ||
        waitingFrom.trim() ||
        waitingReference.trim() ||
        waitingFollowUpDate ||
        initialRecordComment.trim() ||
        initialRecordAttachments.length > 0 ||
        selectedRequirementId
    );
  }

  async function addInitialRecordFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }
    try {
      const parsed = await readFilesAsLocalAttachments(files);
      setInitialRecordAttachments((current) => [...current, ...parsed]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron adjuntar archivos");
    }
  }

  function handleInitialRecordFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    void addInitialRecordFiles(files);
    event.target.value = "";
  }

  function handleRemoveInitialRecordAttachment(localId: string) {
    setInitialRecordAttachments((current) => current.filter((item) => item.local_id !== localId));
  }

  async function handleInitialRecordPaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageFiles = extractImageFilesFromClipboardData(event.clipboardData);
    if (imageFiles.length === 0) {
      return;
    }
    event.preventDefault();
    await addInitialRecordFiles(imageFiles);
  }

  function handleClose() {
    if (hasDraft()) {
      if (!window.confirm("Cerrar sin guardar? Se perderan los datos ingresados.")) {
        return;
      }
    }
    onClose();
  }

  async function loadDuplicateCatalog() {
    if (duplicateCatalogRef.current) {
      return duplicateCatalogRef.current;
    }

    const [workflowSummaries, triggers] = await Promise.all([listWorkflows(), listTriggers()]);
    const operationalIds = workflowSummaries.filter((workflow) => isOperationalWorkflowStatus(workflow.estado)).map((workflow) => workflow.id);
    const workflowDetails = await Promise.all(operationalIds.map((workflowId) => getWorkflow(workflowId)));

    const catalog = {
      workflowsById: Object.fromEntries(workflowDetails.map((workflow) => [workflow.id, workflow])),
      requirementByWorkflowId: buildRequirementByWorkflowId(triggers),
      triggersById: Object.fromEntries(triggers.map((trigger) => [trigger.id, trigger])),
    } satisfies DuplicateCatalog;

    duplicateCatalogRef.current = catalog;
    return catalog;
  }

  function buildCreation(): PendingCreation {
    const executionDateIso = toCalendarDateUtcIso(executionDate);
    const reminderDateIso = toCalendarDateUtcIso(reminderDate);
    const waitingFollowUpIso = toCalendarDateUtcIso(waitingFollowUpDate);
    const normalizedDetail = detail.trim() || null;
    const initialRecord =
      initialRecordComment.trim() || initialRecordAttachments.length > 0
        ? {
            comentario: initialRecordComment.trim() || null,
            attachments: initialRecordAttachments.map((item) => ({
              nombre: item.nombre,
              content_type: item.content_type,
              size_bytes: item.size_bytes,
              content_base64: item.content_base64,
            })),
          }
        : null;

    if (captureMode === "esperando") {
      const waitingPayload = {
        modo_inicio: "esperando" as const,
        objetivo_final: waitingWhat.trim(),
        resolucion_esperada: "Flow completado con validacion final",
        registro_inicial: initialRecord,
        espera_inicial: {
          que_se_espera: waitingWhat.trim(),
          esperando_de: waitingFrom.trim() || null,
          detalle: normalizedDetail,
          referencia_externa: waitingReference.trim() || null,
          fecha_recordatorio: waitingFollowUpIso,
        },
      };

      if (effectiveRequirementId) {
        return {
          kind: "linked",
          requirementId: effectiveRequirementId,
          requirementLabel: effectiveRequirementLabel,
          payload: {
            ...waitingPayload,
            ambito: effectiveRequirementAmbito,
          },
        };
      }

      return {
        kind: "quick",
        payload: {
          titulo: waitingWhat.trim(),
          detalle: normalizedDetail,
          modo_inicio: "esperando",
          registro_inicial: initialRecord,
          espera_inicial: waitingPayload.espera_inicial,
          creado_por: DEFAULT_ACTOR,
          ambito,
        },
      };
    }

    if (effectiveRequirementId) {
      return {
        kind: "linked",
        requirementId: effectiveRequirementId,
        requirementLabel: effectiveRequirementLabel,
        payload: {
          objetivo_final: title.trim(),
          resolucion_esperada: "Flow completado con validacion final",
          ambito: effectiveRequirementAmbito,
          modo_inicio: "tarea_activa",
          registro_inicial: initialRecord,
          primer_paso: {
            nombre: title.trim(),
            descripcion: normalizedDetail,
            asignado_a: assignee.trim() || DEFAULT_ACTOR,
            fecha_vencimiento: reminderDateIso,
            fecha_ejecucion_estimada: executionDateIso,
          },
        },
      };
    }

    return {
      kind: "quick",
      payload: {
        titulo: title.trim(),
        detalle: normalizedDetail,
        asignado_a: assignee.trim() || DEFAULT_ACTOR,
        fecha_vencimiento: reminderDateIso,
        fecha_ejecucion_estimada: executionDateIso,
        modo_inicio: "tarea_activa",
        registro_inicial: initialRecord,
        creado_por: DEFAULT_ACTOR,
        ambito,
      },
    };
  }

  function buildDuplicateInput(creation: PendingCreation) {
    if (creation.kind === "linked") {
      if (creation.payload.modo_inicio === "esperando") {
        return {
          taskName: creation.payload.espera_inicial?.que_se_espera ?? creation.payload.objetivo_final ?? "",
          taskDescription: creation.payload.espera_inicial?.detalle ?? null,
          workflowObjective: creation.payload.objetivo_final,
          requirementId: creation.requirementId,
          requirementLabel: creation.requirementLabel,
          reminderAt: creation.payload.espera_inicial?.fecha_recordatorio ?? null,
          waitingFrom: creation.payload.espera_inicial?.esperando_de ?? null,
          externalReference: creation.payload.espera_inicial?.referencia_externa ?? null,
          ambito: creation.payload.ambito ?? null,
        };
      }

      return {
        taskName: creation.payload.primer_paso?.nombre ?? "",
        taskDescription: creation.payload.primer_paso?.descripcion ?? null,
        workflowObjective: creation.payload.objetivo_final,
        requirementId: creation.requirementId,
        requirementLabel: creation.requirementLabel,
        reminderAt: creation.payload.primer_paso?.fecha_vencimiento ?? null,
        ambito: creation.payload.ambito ?? null,
      };
    }

    if (creation.payload.modo_inicio === "esperando") {
      return {
        taskName: creation.payload.espera_inicial?.que_se_espera ?? creation.payload.titulo,
        taskDescription: creation.payload.espera_inicial?.detalle ?? creation.payload.detalle,
        reminderAt: creation.payload.espera_inicial?.fecha_recordatorio ?? null,
        waitingFrom: creation.payload.espera_inicial?.esperando_de ?? null,
        externalReference: creation.payload.espera_inicial?.referencia_externa ?? null,
        ambito: creation.payload.ambito,
      };
    }

    return {
      taskName: creation.payload.titulo,
      taskDescription: creation.payload.detalle,
      reminderAt: creation.payload.fecha_vencimiento ?? null,
      ambito: creation.payload.ambito,
    };
  }

  useEffect(() => {
    const primaryText = captureMode === "tarea_activa" ? title : waitingWhat;
    const duplicateText = `${primaryText} ${detail}`.trim();
    const normalizedInput = normalizeText(duplicateText);
    const significantTokens = getSignificantTokens(`${primaryText} ${detail} ${waitingFrom} ${waitingReference}`.trim());

    if (significantTokens.length === 0 || normalizedInput.length < 3 || (isLinkedCapture && effectiveRequirementAmbito === null)) {
      liveRequestIdRef.current += 1;
      setCheckingLiveDuplicates(false);
      setLiveDuplicateCandidates([]);
      return;
    }

    const requestId = liveRequestIdRef.current + 1;
    liveRequestIdRef.current = requestId;

    const timeoutId = window.setTimeout(async () => {
      setCheckingLiveDuplicates(true);

      try {
        const catalog = await loadDuplicateCatalog();
        if (liveRequestIdRef.current !== requestId) return;

        const candidates = findSimilarFlows(
          {
            taskName: captureMode === "tarea_activa" ? title.trim() : waitingWhat.trim(),
            taskDescription: detail.trim() || null,
            workflowObjective: isLinkedCapture ? (captureMode === "tarea_activa" ? title.trim() : waitingWhat.trim()) : null,
            requirementId: effectiveRequirementId,
            requirementLabel: effectiveRequirementLabel,
            reminderAt: toCalendarDateUtcIso(captureMode === "tarea_activa" ? reminderDate : waitingFollowUpDate),
            waitingFrom: captureMode === "esperando" ? waitingFrom.trim() || null : null,
            externalReference: captureMode === "esperando" ? waitingReference.trim() || null : null,
            ambito: isLinkedCapture ? effectiveRequirementAmbito : ambito,
          },
          catalog.workflowsById,
          catalog.requirementByWorkflowId
        );

        if (liveRequestIdRef.current !== requestId) return;
        setLiveDuplicateCandidates(candidates);
      } catch (err) {
        if (liveRequestIdRef.current !== requestId) return;
        console.warn("No se pudieron cargar sugerencias de duplicados en vivo.", err);
        setLiveDuplicateCandidates([]);
      } finally {
        if (liveRequestIdRef.current === requestId) {
          setCheckingLiveDuplicates(false);
        }
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    ambito,
    captureMode,
    detail,
    effectiveRequirementAmbito,
    effectiveRequirementId,
    effectiveRequirementLabel,
    isLinkedCapture,
    reminderDate,
    title,
    waitingFollowUpDate,
    waitingFrom,
    waitingReference,
    waitingWhat,
  ]);

  async function performCreate(creation: PendingCreation) {
    try {
      setSubmitting(true);
      setError(null);
      const workflow =
        creation.kind === "linked"
          ? await startWorkflow(creation.requirementId, creation.payload)
          : await quickCaptureFlow(creation.payload);
      if (creation.kind === "linked") {
        showToast("Flow vinculado al proyecto.", "success");
      } else if (creation.payload.ambito !== getStoredActiveAmbito()) {
        showToast(
          `Tarea capturada como ${getAmbitoLabel(creation.payload.ambito)}. Cambia a ${getAmbitoLabel(creation.payload.ambito)} para verla en la lista.`,
          "info"
        );
      } else {
        showToast(captureMode === "esperando" ? "Espera capturada." : "Tarea capturada.", "success");
      }
      onClose();
      navigateWithOrigin(navigate, getOriginLocationWithoutModal(), `/workflows/${workflow.id}`, "/flows");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : creation.kind === "linked"
            ? "No se pudo crear el flow vinculado"
            : "No se pudo capturar el flow"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function maybeWarnDuplicates(creation: PendingCreation) {
    try {
      setCheckingDuplicates(true);
      const catalog = await loadDuplicateCatalog();
      const candidates = findSimilarFlows(buildDuplicateInput(creation), catalog.workflowsById, catalog.requirementByWorkflowId);

      if (candidates.length > 0) {
        setPendingCreation(creation);
        setDuplicateCandidates(candidates);
        return true;
      }

      return false;
    } catch (err) {
      console.warn("No se pudo revisar duplicados antes de capturar la tarea.", err);
      return false;
    } finally {
      setCheckingDuplicates(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError(
        captureMode === "tarea_activa"
          ? "Escribe la tarea principal para capturar el flow."
          : "Escribe que estas esperando para capturar el flow."
      );
      return;
    }

    if (captureMode === "tarea_activa") {
      const reminderError = getReminderDateError(reminderDate);
      if (reminderError) {
        setError(reminderError);
        return;
      }
    } else {
      const waitingFollowUpError = getReminderDateError(waitingFollowUpDate);
      if (waitingFollowUpError) {
        setError(waitingFollowUpError);
        return;
      }
    }

    if (isLinkedCapture && effectiveRequirementAmbito === null) {
      setError("Debes definir el ambito del proyecto antes de crear un flow vinculado.");
      return;
    }

    const creation = buildCreation();
    const shouldWarn = await maybeWarnDuplicates(creation);
    if (shouldWarn) return;

    await performCreate(creation);
  }

  async function handleCreateAnyway() {
    if (!pendingCreation) return;
    setDuplicateCandidates([]);
    setPendingCreation(null);
    await performCreate(pendingCreation);
  }

  function handleOpenExisting(workflowId: string) {
    setDuplicateCandidates([]);
    setPendingCreation(null);
    navigateWithOrigin(navigate, getOriginLocationWithoutModal(), `/workflows/${workflowId}`, "/flows");
  }

  function handleOpenExistingFromSuggestions(workflowId: string) {
    navigateWithOrigin(navigate, getOriginLocationWithoutModal(), `/workflows/${workflowId}`, "/flows");
  }

  function handleOpenLinkedRequirement(requirementId: string) {
    navigateWithOrigin(navigate, getOriginLocationWithoutModal(), `/requirements/${requirementId}`, "/requirements");
  }

  function handleCancelDuplicateWarning() {
    setDuplicateCandidates([]);
    setPendingCreation(null);
  }

  return (
    <>
      <Dialog open onClose={submitting || checkingDuplicates ? undefined : () => handleClose()} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Captura rapida
            </Typography>
            <Typography variant="h4">
              {captureMode === "tarea_activa" ? "Capturar tarea" : "Capturar espera"}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: "outlineVariant" }}>
          <Stack spacing={2.5}>
            {isLinkedCapture && effectiveRequirementLabel && (
              <Alert severity={effectiveRequirementAmbito ? "info" : "warning"} sx={{ py: 0.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography component="span">Proyecto vinculado:</Typography>
                  {effectiveRequirementId ? (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => handleOpenLinkedRequirement(effectiveRequirementId)}
                      sx={{ px: 0.5, textTransform: "none" }}
                    >
                      {effectiveRequirementLabel}
                    </Button>
                  ) : (
                    <Typography component="span">{effectiveRequirementLabel}</Typography>
                  )}
                  <AmbitoChip ambito={effectiveRequirementAmbito} />
                </Stack>
              </Alert>
            )}

            {!defaultRequirementId && (
              <Stack spacing={1}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={ambito}
                  onChange={(_, value: Exclude<Ambito, null> | null) => {
                    if (!value) return;
                    setAmbito(value);
                  }}
                  sx={{ alignSelf: "flex-start" }}
                  aria-label="Ambito de la captura"
                >
                  <ToggleButton value="laboral">Laboral</ToggleButton>
                  <ToggleButton value="personal">Personal</ToggleButton>
                </ToggleButtonGroup>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography component="span">Se creara como:</Typography>
                    <AmbitoChip ambito={ambito} />
                  </Stack>
                </Alert>
              </Stack>
            )}

            <ToggleButtonGroup
              exclusive
              size="small"
              value={captureMode}
              onChange={(_, value: WorkflowStartMode | null) => {
                if (!value) return;
                setCaptureMode(value);
                setError(null);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              <ToggleButton value="tarea_activa">Tarea para hacer</ToggleButton>
              <ToggleButton value="esperando">Estoy esperando algo</ToggleButton>
            </ToggleButtonGroup>

            {captureMode === "tarea_activa" ? (
              <TextField
                autoFocus
                inputRef={primaryInputRef}
                label="Que tenes que hacer? *"
                multiline
                minRows={3}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Pedir layout actualizado al proveedor"
                disabled={isLinkedCapture && effectiveRequirementAmbito === null}
              />
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  autoFocus
                  inputRef={primaryInputRef}
                  label="Que estas esperando? *"
                  multiline
                  minRows={3}
                  value={waitingWhat}
                  onChange={(event) => setWaitingWhat(event.target.value)}
                  placeholder="Ej. Confirmacion del proveedor sobre el layout"
                  disabled={isLinkedCapture && effectiveRequirementAmbito === null}
                />
                <TextField
                  label="De quien?"
                  value={waitingFrom}
                  onChange={(event) => setWaitingFrom(event.target.value)}
                  fullWidth
                />
              </Stack>
            )}

            <Stack spacing={1.25}>
              <TextField
                label="Registro inicial (opcional)"
                multiline
                minRows={2}
                value={initialRecordComment}
                onChange={(event) => setInitialRecordComment(event.target.value)}
                onPaste={(event) => void handleInitialRecordPaste(event)}
                placeholder="Contexto, evidencia o nota inicial..."
                disabled={isLinkedCapture && effectiveRequirementAmbito === null}
              />
              <Stack spacing={1.25}>
                <Button component="label" variant="outlined" color="inherit" disabled={isLinkedCapture && effectiveRequirementAmbito === null}>
                  Adjuntar archivos al registro inicial
                  <input hidden multiple type="file" onChange={handleInitialRecordFileChange} />
                </Button>
                <AttachmentDraftGrid attachments={initialRecordAttachments} onRemove={handleRemoveInitialRecordAttachment} />
              </Stack>
            </Stack>

            <LiveDuplicateSuggestions
              candidates={liveDuplicateCandidates}
              checking={checkingLiveDuplicates}
              onOpenExisting={handleOpenExistingFromSuggestions}
              onOpenRequirement={handleOpenLinkedRequirement}
            />

            {!defaultRequirementId && (
              <TextField
                select
                label="Asociar a proyecto existente"
                value={selectedRequirementId}
                onChange={(event) => setSelectedRequirementId(event.target.value)}
                disabled={loadingRequirements}
                helperText={
                  loadingRequirements
                    ? "Cargando proyectos..."
                    : "Opcional. Si seleccionas un proyecto, el flow quedara vinculado a ese proyecto."
                }
              >
                <MenuItem value="">Sin proyecto asociado</MenuItem>
                {availableRequirements
                  .filter((requirement) => requirement.ambito === ambito)
                  .map((requirement) => (
                    <MenuItem key={requirement.id} value={requirement.id}>
                      {requirement.descripcion?.trim() || `Proyecto ${requirement.id.slice(0, 8)}`}
                    </MenuItem>
                  ))}
              </TextField>
            )}

            <Button
              variant="text"
              color="inherit"
              onClick={() => setShowOptional((current) => !current)}
              sx={{ alignSelf: "flex-start", px: 0.5 }}
            >
              <TuneRoundedIcon sx={{ fontSize: 16, mr: 0.6 }} />
              {showOptional ? "Ocultar datos opcionales" : "Agregar datos opcionales"}
            </Button>

            <Collapse in={showOptional} timeout={theme.appMotion.short}>
              <Box
                sx={(currentTheme) => ({
                  p: { xs: 2, md: 2.5 },
                  borderRadius: currentTheme.appShape.md,
                  border: "1px solid",
                  borderColor: currentTheme.palette.outlineVariant,
                  backgroundColor: alpha(
                    currentTheme.palette.surfaceContainerLow,
                    currentTheme.palette.mode === "dark" ? 0.84 : 0.98
                  ),
                })}
              >
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Datos opcionales
                  </Typography>

                  <TextField
                    label="Detalle"
                    multiline
                    minRows={2}
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                  />

                  {captureMode === "tarea_activa" ? (
                    <>
                      <TextField label="Asignado a" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
                      <TextField
                        label="Fecha operativa"
                        type="date"
                        value={executionDate}
                        onChange={(event) => setExecutionDate(event.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <ReminderDateField
                        value={reminderDate}
                        onChange={(value) => {
                          setReminderDate(value);
                          if (error) setError(null);
                        }}
                        helperText="Recordatorio"
                      />
                    </>
                  ) : (
                    <>
                      <TextField
                        label="Referencia"
                        value={waitingReference}
                        onChange={(event) => setWaitingReference(event.target.value)}
                      />
                      <ReminderDateField
                        value={waitingFollowUpDate}
                        onChange={(value) => {
                          setWaitingFollowUpDate(value);
                          if (error) setError(null);
                        }}
                        helperText="Seguimiento opcional"
                      />
                    </>
                  )}
                </Stack>
              </Box>
            </Collapse>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary">
            {isLinkedCapture
              ? "Se creara un flow vinculado a este proyecto."
              : captureMode === "esperando"
                ? "Se crea un flow que arranca esperando respuesta externa."
                : "Se crea un flow con una tarea activa inicial."}
          </Typography>
          <Stack direction="row" spacing={1.25}>
            <Button variant="text" color="inherit" onClick={handleClose} disabled={submitting || checkingDuplicates}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting || checkingDuplicates || !canSubmit || (isLinkedCapture && effectiveRequirementAmbito === null)}
              startIcon={<AddTaskRoundedIcon />}
            >
              {checkingDuplicates ? "Revisando..." : submitting ? "Guardando..." : "Capturar"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <DuplicateFlowWarningDialog
        open={duplicateCandidates.length > 0}
        candidates={duplicateCandidates}
        busy={submitting}
        onOpenExisting={handleOpenExisting}
        onOpenRequirement={handleOpenLinkedRequirement}
        onCreateAnyway={() => void handleCreateAnyway()}
        onCancel={handleCancelDuplicateWarning}
      />
    </>
  );
}
