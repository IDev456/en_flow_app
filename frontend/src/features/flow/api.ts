import { apiDelete, apiGet, apiPatch, apiPost, apiRequest } from "../../api/client";
import type {
  CreateRequirementFromFlowInput,
  DailyBoardData,
  LinkRequirementInput,
  Step,
  StepComment,
  StepCommentInput,
  StepCompleteInput,
  ExternalResponseDecisionInput,
  ExternalEvent,
  ExternalEventCreateInput,
  StepHistoryEntry,
  QuickCaptureInput,
  StepStatusUpdateInput,
  Trigger,
  TriggerCreateInput,
  TriggerDetail,
  TriggerUpdateInput,
  WorkflowDetail,
  WorkflowStartInput,
  WorkflowSummary
} from "./types";

export function listTriggers() {
  return apiGet<TriggerDetail[]>("/requirements/");
}

export function createTrigger(input: TriggerCreateInput) {
  return apiPost<Trigger>("/requirements/", input);
}

export function deleteTrigger(triggerId: string) {
  return apiDelete(`/requirements/${triggerId}`);
}

export function getTrigger(triggerId: string) {
  return apiGet<TriggerDetail>(`/requirements/${triggerId}`);
}

export function updateTrigger(triggerId: string, input: TriggerUpdateInput) {
  return apiPatch<TriggerDetail>(`/requirements/${triggerId}`, input);
}

export function startWorkflow(triggerId: string, input: WorkflowStartInput) {
  return apiPost<WorkflowDetail>(`/requirements/${triggerId}/start-workflow`, input);
}

export function listWorkflows() {
  return apiGet<WorkflowSummary[]>("/workflows/");
}

export function listActiveWorkflows() {
  return apiGet<WorkflowSummary[]>("/dashboard/active-workflows");
}

export function listPendingSteps() {
  return apiGet<Step[]>("/dashboard/pending-steps");
}

export function getDailyBoard() {
  return apiGet<DailyBoardData>("/dashboard/daily-board");
}

export function getWorkflow(workflowId: string) {
  return apiGet<WorkflowDetail>(`/workflows/${workflowId}`);
}

export function updateWorkflow(workflowId: string, input: { objetivo_final?: string | null }) {
  return apiPatch<WorkflowDetail>(`/workflows/${workflowId}`, input);
}

export function cancelWorkflow(workflowId: string) {
  return apiPatch<WorkflowDetail>(`/workflows/${workflowId}/cancel`, {});
}

export function reactivateWorkflow(workflowId: string) {
  return apiPatch<WorkflowDetail>(`/workflows/${workflowId}/reactivate`, {});
}

export function deleteWorkflow(workflowId: string) {
  return apiDelete(`/workflows/${workflowId}`);
}

export function quickCaptureFlow(input: QuickCaptureInput) {
  return apiPost<WorkflowDetail>("/workflows/quick-capture", input);
}

export function linkWorkflowRequirement(workflowId: string, input: LinkRequirementInput) {
  return apiPost<WorkflowDetail>(`/workflows/${workflowId}/link-requirement`, input);
}

export function unlinkWorkflowRequirement(workflowId: string, requirementId: string) {
  return apiRequest<WorkflowDetail>(`/workflows/${workflowId}/unlink-requirement/${requirementId}`, { method: "DELETE" });
}

export function createRequirementFromFlow(workflowId: string, input: CreateRequirementFromFlowInput) {
  return apiPost<TriggerDetail>(`/workflows/${workflowId}/create-requirement`, input);
}

export function getWorkflowSteps(workflowId: string) {
  return apiGet<Step[]>(`/workflows/${workflowId}/steps`);
}

export function getStep(stepId: string) {
  return apiGet<Step>(`/steps/${stepId}`);
}

export function updateStep(
  stepId: string,
  input: { nombre?: string; descripcion?: string | null; fecha_ejecucion_estimada?: string | null }
) {
  return apiPatch<Step>(`/steps/${stepId}`, input);
}

export function updateStepStatus(stepId: string, input: StepStatusUpdateInput) {
  return apiPatch<Step>(`/steps/${stepId}/status`, input);
}

export function completeStep(stepId: string, input: StepCompleteInput) {
  return apiPost<Step>(`/steps/${stepId}/complete`, input);
}

export function addStepComment(stepId: string, input: StepCommentInput) {
  return apiPost<StepComment>(`/steps/${stepId}/comments`, input);
}

export function getStepComments(stepId: string) {
  return apiGet<StepComment[]>(`/steps/${stepId}/comments`);
}

export function getStepHistory(stepId: string) {
  return apiGet<StepHistoryEntry[]>(`/steps/${stepId}/history`);
}

export function registerExternalEvent(stepId: string, input: ExternalEventCreateInput) {
  return apiPost<ExternalEvent>(`/steps/${stepId}/external-events`, input);
}

export function resolveExternalResponse(stepId: string, input: ExternalResponseDecisionInput) {
  return apiPost<Step>(`/steps/${stepId}/external-response/resolve`, input);
}

export function listStepExternalEvents(stepId: string) {
  return apiGet<ExternalEvent[]>(`/steps/${stepId}/external-events`);
}

export function listWorkflowExternalEvents(workflowId: string) {
  return apiGet<ExternalEvent[]>(`/workflows/${workflowId}/external-events`);
}
