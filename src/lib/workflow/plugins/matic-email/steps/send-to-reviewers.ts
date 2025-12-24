
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
import type { MaticEmailCredentials } from "../credentials";

type SendToReviewersResult =
  | { success: true; sentCount: number; reviewers: string }
  | { success: false; error: string };

export type SendToReviewersCoreInput = {
  applicationId: string;
  subject: string;
  body: string;
  includeReviewLink?: string;
};

export type SendToReviewersInput = StepInput &
  SendToReviewersCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for sending email to reviewers
 */
async function stepHandler(
  input: SendToReviewersCoreInput,
  credentials: MaticEmailCredentials
): Promise<SendToReviewersResult> {
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
    // Fetch assigned reviewers
    const reviewersResponse = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}/reviewers`,
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

    if (!reviewersResponse.ok) {
      return {
        success: false,
        error: "Could not fetch reviewers",
      };
    }

    const reviewersData = await reviewersResponse.json();
    const reviewerEmails: string[] = reviewersData
      .map((r: any) => r.email)
      .filter(Boolean);

    if (reviewerEmails.length === 0) {
      return {
        success: false,
        error: "No reviewers assigned to this application",
      };
    }

    // Build email body
    let emailBody = input.body;

    // Add review link if requested
    if (input.includeReviewLink === "true") {
      // Get workspace info for review URL
      const workspaceResponse = await fetch(
        `${apiUrl}/api/v1/workspaces/${workspaceId}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(credentials.MATIC_API_KEY && {
              Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
            }),
          },
        }
      );

      if (workspaceResponse.ok) {
        const workspaceData = await workspaceResponse.json();
        const reviewUrl = workspaceData.app_url || "https://app.maticslab.com";
        emailBody += `\n\n---\nReview this application: ${reviewUrl}/workspace/${workspaceId}/forms/${formId}/submissions/${input.applicationId}`;
      }
    }

    // Send email to all reviewers
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
        to: reviewerEmails,
        subject: input.subject,
        body: emailBody,
        html_body: emailBody.replace(/\n/g, "<br>"),
        application_id: input.applicationId,
        email_type: "reviewer_notification",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to send email: ${response.status}`,
      };
    }

    return {
      success: true,
      sentCount: reviewerEmails.length,
      reviewers: reviewerEmails.join(", "),
    };
  } catch (error) {
    return {
      success: false,
      error: `Email to reviewers failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function sendToReviewersStep(
  input: SendToReviewersInput
): Promise<SendToReviewersResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticEmailCredentials));
}
sendToReviewersStep.maxRetries = 0;

export const _integrationType = "matic-email";
