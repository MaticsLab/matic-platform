import "server-only";

import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
import type { MaticEmailCredentials } from "../credentials";

type SendNotificationResult =
  | { success: true; messageId: string; notificationType: string }
  | { success: false; error: string };

export type SendNotificationCoreInput = {
  applicationId: string;
  notificationType: 
    | "submission_received"
    | "under_review"
    | "approved"
    | "rejected"
    | "waitlisted"
    | "more_info_needed"
    | "stage_changed";
  customMessage?: string;
};

export type SendNotificationInput = StepInput &
  SendNotificationCoreInput & {
    integrationId?: string;
  };

// Email templates for each notification type
const NOTIFICATION_TEMPLATES: Record<string, { subject: string; body: string }> = {
  submission_received: {
    subject: "Application Received",
    body: "Thank you for submitting your application. We have received it and will begin reviewing it shortly.\n\nYou will receive updates as your application progresses through our review process.",
  },
  under_review: {
    subject: "Application Under Review",
    body: "Your application is now being reviewed by our team.\n\nWe will notify you once a decision has been made. This process typically takes 2-4 weeks.",
  },
  approved: {
    subject: "Congratulations! Application Approved",
    body: "We are pleased to inform you that your application has been approved!\n\nPlease check your application portal for next steps and any additional instructions.",
  },
  rejected: {
    subject: "Application Decision",
    body: "Thank you for your application. After careful consideration, we regret to inform you that we are unable to move forward with your application at this time.\n\nWe appreciate your interest and encourage you to apply again in the future.",
  },
  waitlisted: {
    subject: "Application Waitlisted",
    body: "Your application has been placed on our waitlist. While we cannot confirm a spot at this time, we will contact you if an opening becomes available.\n\nThank you for your patience.",
  },
  more_info_needed: {
    subject: "Additional Information Needed",
    body: "We are reviewing your application but need some additional information to proceed.\n\nPlease log in to your application portal to see what information is needed and submit it at your earliest convenience.",
  },
  stage_changed: {
    subject: "Application Status Update",
    body: "Your application has moved to a new stage in our review process.\n\nPlease check your application portal for the latest status and any updates.",
  },
};

/**
 * Core logic for sending notification
 */
async function stepHandler(
  input: SendNotificationCoreInput,
  credentials: MaticEmailCredentials
): Promise<SendNotificationResult> {
  const apiUrl = credentials.MATIC_API_URL;
  const workspaceId = credentials.MATIC_WORKSPACE_ID;
  const formId = credentials.MATIC_FORM_ID;

  if (!apiUrl) {
    return {
      success: false,
      error: "MATIC_API_URL is not configured.",
    };
  }

  if (!workspaceId) {
    return {
      success: false,
      error: "MATIC_WORKSPACE_ID is not configured.",
    };
  }

  try {
    // Get application details to find applicant email
    const appResponse = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
      }
    );

    if (!appResponse.ok) {
      return {
        success: false,
        error: "Could not find application",
      };
    }

    const appData = await appResponse.json();
    const applicantEmail = appData.applicant_email || appData.data?.email;

    if (!applicantEmail) {
      return {
        success: false,
        error: "No applicant email found",
      };
    }

    // Get template
    const template = NOTIFICATION_TEMPLATES[input.notificationType];
    if (!template) {
      return {
        success: false,
        error: `Unknown notification type: ${input.notificationType}`,
      };
    }

    // Build email body
    let emailBody = template.body;
    if (input.customMessage) {
      emailBody += `\n\n${input.customMessage}`;
    }

    // Send email via Matic email API
    const response = await fetch(`${apiUrl}/api/v1/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(credentials.MATIC_API_KEY && {
          Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
        }),
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        to: [applicantEmail],
        subject: template.subject,
        body: emailBody,
        html_body: emailBody.replace(/\n/g, "<br>"),
        application_id: input.applicationId,
        notification_type: input.notificationType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to send notification: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.message_id || data.id || "",
      notificationType: input.notificationType,
    };
  } catch (error) {
    return {
      success: false,
      error: `Notification send failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function sendNotificationStep(
  input: SendNotificationInput
): Promise<SendNotificationResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticEmailCredentials));
}
sendNotificationStep.maxRetries = 0;

export const _integrationType = "matic-email";
