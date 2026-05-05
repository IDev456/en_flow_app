import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/client";
import type {
  Step,
  StepComment,
  StepCommentInput,
  StepCompleteInput,
  ExternalResponseDecisionInput,
  ExternalEvent,
  ExternalEventCreateInput,
  StepHistoryEntry,
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
  return apiGet<TriggerDetail[]>("/triggers/");
}

export function createTrigger(input: TriggerCreateInput) {
  return apiPost<Trigger>("/triggers/", input);
}

export function deleteTrigger(triggerId: string) {
  return apiDelete(`/triggers/${triggerId}`);
}

export function getTrigger(triggerId: string) {
  return apiGet<TriggerDetail>(`/triggers/${triggerId}`);
}

export function updateTrigger(triggerId: string, input: TriggerUpdateInput) {
  return apiPatch<TriggerDetail>(`/triggers/${triggerId}`, input);
}

export function startWorkflow(triggerId: string, input: WorkflowStartInput) {
  return apiPost<WorkflowDetail>(`/triggers/${triggerId}/start-workflow`, input);
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

export function getWorkflow(workflowId: string) {
  return apiGet<WorkflowDetail>(`/workflows/${workflowId}`);
}

export function getWorkflowSteps(workflowId: string) {
  return apiGet<Step[]>(`/workflows/${workflowId}/steps`);
}

export function getStep(stepId: string) {
  return apiGet<Step>(`/steps/${stepId}`);
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
