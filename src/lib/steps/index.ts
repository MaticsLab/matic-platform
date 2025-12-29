/**
 * Step registry - maps action types to executable step functions
 * This allows the workflow executor to call step functions directly
 * without code generation or eval()
 */

// Matic Email steps
import type { sendEmailStep as maticSendEmailStep } from "@/lib/workflow/plugins/matic-email/steps/send-email";
import type { sendNotificationStep } from "@/lib/workflow/plugins/matic-email/steps/send-notification";
import type { sendToReviewersStep } from "@/lib/workflow/plugins/matic-email/steps/send-to-reviewers";

// Matic Review steps
import type { moveToStageStep } from "@/lib/workflow/plugins/matic-review/steps/move-to-stage";
import type { assignReviewersStep } from "@/lib/workflow/plugins/matic-review/steps/assign-reviewers";
import type { addTagsStep } from "@/lib/workflow/plugins/matic-review/steps/add-tags";
import type { removeTagsStep } from "@/lib/workflow/plugins/matic-review/steps/remove-tags";
import type { setStatusStep } from "@/lib/workflow/plugins/matic-review/steps/set-status";
import type { getApplicationStep } from "@/lib/workflow/plugins/matic-review/steps/get-application";
import type { checkScoreStep } from "@/lib/workflow/plugins/matic-review/steps/check-score";

// Resend steps
import type { sendEmailStep as resendSendEmailStep } from "@/lib/workflow/plugins/resend/steps/send-email";

// Core steps
import type { conditionStep } from "./condition";
import type { httpRequestStep } from "./http-request";

// Step function type
export type StepFunction = (input: Record<string, unknown>) => Promise<unknown>;

// Registry of all available steps
export const stepRegistry: Record<string, StepFunction> = {
  // Core steps
  "HTTP Request": async (input) =>
    (await import("./http-request")).httpRequestStep(
      input as Parameters<typeof httpRequestStep>[0]
    ),
  Condition: async (input) =>
    (await import("./condition")).conditionStep(
      input as Parameters<typeof conditionStep>[0]
    ),
  
  // Matic Email steps
  "matic-email:send-email": async (input) =>
    (await import("@/lib/workflow/plugins/matic-email/steps/send-email")).sendEmailStep(
      input as Parameters<typeof maticSendEmailStep>[0]
    ),
  "matic-email:send-notification": async (input) =>
    (await import("@/lib/workflow/plugins/matic-email/steps/send-notification")).sendNotificationStep(
      input as Parameters<typeof sendNotificationStep>[0]
    ),
  "matic-email:send-to-reviewers": async (input) =>
    (await import("@/lib/workflow/plugins/matic-email/steps/send-to-reviewers")).sendToReviewersStep(
      input as Parameters<typeof sendToReviewersStep>[0]
    ),
  
  // Matic Review steps
  "matic-review:move-to-stage": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/move-to-stage")).moveToStageStep(
      input as Parameters<typeof moveToStageStep>[0]
    ),
  "matic-review:assign-reviewers": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/assign-reviewers")).assignReviewersStep(
      input as Parameters<typeof assignReviewersStep>[0]
    ),
  "matic-review:add-tags": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/add-tags")).addTagsStep(
      input as Parameters<typeof addTagsStep>[0]
    ),
  "matic-review:remove-tags": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/remove-tags")).removeTagsStep(
      input as Parameters<typeof removeTagsStep>[0]
    ),
  "matic-review:set-status": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/set-status")).setStatusStep(
      input as Parameters<typeof setStatusStep>[0]
    ),
  "matic-review:get-application": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/get-application")).getApplicationStep(
      input as Parameters<typeof getApplicationStep>[0]
    ),
  "matic-review:check-score": async (input) =>
    (await import("@/lib/workflow/plugins/matic-review/steps/check-score")).checkScoreStep(
      input as Parameters<typeof checkScoreStep>[0]
    ),
  
  // Resend steps
  "resend:send-email": async (input) =>
    (await import("@/lib/workflow/plugins/resend/steps/send-email")).sendEmailStep(
      input as Parameters<typeof resendSendEmailStep>[0]
    ),
  // Legacy aliases for backwards compatibility
  "Send Email": async (input) =>
    (await import("@/lib/workflow/plugins/resend/steps/send-email")).sendEmailStep(
      input as Parameters<typeof resendSendEmailStep>[0]
    ),
};

// Helper to check if a step exists
export function hasStep(actionType: string): boolean {
  return actionType in stepRegistry;
}

// Helper to get a step function
export function getStep(actionType: string): StepFunction | undefined {
  return stepRegistry[actionType];
}
