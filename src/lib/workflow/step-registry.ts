/**
 * Step Registry
 *
 * Matic Platform step registry for workflow actions.
 * Only includes Matic internal plugins and Resend.
 */


// biome-ignore lint/suspicious/noExplicitAny: Dynamic step module types - step functions take any input
export type StepFunction = (input: any) => Promise<any>;

// Step modules may contain the step function plus other exports (types, constants, etc.)
// biome-ignore lint/suspicious/noExplicitAny: Dynamic module with mixed exports
export type StepModule = Record<string, any>;

export type StepImporter = {
  importer: () => Promise<StepModule>;
  stepFunction: string;
};

/**
 * Plugin step importers - maps action types to their step import functions
 * These imports are statically analyzable by the bundler
 */
export const PLUGIN_STEP_IMPORTERS: Record<string, StepImporter> = {
  // Matic Email steps
  "matic-email/send-email": {
    importer: () => import("@/lib/workflow/plugins/matic-email/steps/send-email"),
    stepFunction: "sendEmailStep",
  },
  "matic-email/send-notification": {
    importer: () => import("@/lib/workflow/plugins/matic-email/steps/send-notification"),
    stepFunction: "sendNotificationStep",
  },
  "matic-email/send-to-reviewers": {
    importer: () => import("@/lib/workflow/plugins/matic-email/steps/send-to-reviewers"),
    stepFunction: "sendToReviewersStep",
  },
  
  // Matic Review steps
  "matic-review/move-to-stage": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/move-to-stage"),
    stepFunction: "moveToStageStep",
  },
  "matic-review/assign-reviewers": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/assign-reviewers"),
    stepFunction: "assignReviewersStep",
  },
  "matic-review/add-tags": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/add-tags"),
    stepFunction: "addTagsStep",
  },
  "matic-review/remove-tags": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/remove-tags"),
    stepFunction: "removeTagsStep",
  },
  "matic-review/set-status": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/set-status"),
    stepFunction: "setStatusStep",
  },
  "matic-review/get-application": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/get-application"),
    stepFunction: "getApplicationStep",
  },
  "matic-review/check-score": {
    importer: () => import("@/lib/workflow/plugins/matic-review/steps/check-score"),
    stepFunction: "checkScoreStep",
  },
  
  // Resend steps
  "resend/send-email": {
    importer: () => import("@/lib/workflow/plugins/resend/steps/send-email"),
    stepFunction: "sendEmailStep",
  },
  // Legacy alias for backwards compatibility
  "Send Email": {
    importer: () => import("@/lib/workflow/plugins/resend/steps/send-email"),
    stepFunction: "sendEmailStep",
  },
};

/**
 * Action labels - maps action IDs to human-readable labels
 * Used for displaying friendly names in the UI (e.g., Runs tab)
 */
export const ACTION_LABELS: Record<string, string> = {
  // Matic Email
  "matic-email/send-email": "Send Email",
  "matic-email/send-notification": "Send Notification",
  "matic-email/send-to-reviewers": "Email Reviewers",
  
  // Matic Review
  "matic-review/move-to-stage": "Move to Stage",
  "matic-review/assign-reviewers": "Assign Reviewers",
  "matic-review/add-tags": "Add Tags",
  "matic-review/remove-tags": "Remove Tags",
  "matic-review/set-status": "Set Status",
  "matic-review/get-application": "Get Application Data",
  "matic-review/check-score": "Check Score",
  
  // Resend
  "resend/send-email": "Send Email",
  "Send Email": "Send Email",
};

/**
 * Get a step importer for an action type
 */
export function getStepImporter(actionType: string): StepImporter | undefined {
  return PLUGIN_STEP_IMPORTERS[actionType];
}

/**
 * Get the human-readable label for an action type
 */
export function getActionLabel(actionType: string): string | undefined {
  return ACTION_LABELS[actionType];
}
