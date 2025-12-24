
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
import type { MaticEmailCredentials } from "../credentials";

type SendEmailResult =
  | { success: true; messageId: string; sentTo: string; sentAt: string }
  | { success: false; error: string };

export type SendEmailCoreInput = {
  recipientType: "applicant" | "custom" | "reviewers";
  customEmails?: string;
  applicationId: string;
  subject: string;
  body: string;
  includeApplicationLink?: string;
};

export type SendEmailInput = StepInput &
  SendEmailCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for sending email
 */
async function stepHandler(
  input: SendEmailCoreInput,
  credentials: MaticEmailCredentials
): Promise<SendEmailResult> {
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

  // Determine recipients
  let recipients: string[] = [];

  try {
    if (input.recipientType === "applicant") {
      // Fetch applicant email from submission
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

      if (appResponse.ok) {
        const appData = await appResponse.json();
        // Try to find email from submission data
        if (appData.applicant_email) {
          recipients.push(appData.applicant_email);
        } else if (appData.data?.email) {
          recipients.push(appData.data.email);
        }
      }
    } else if (input.recipientType === "reviewers") {
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

      if (reviewersResponse.ok) {
        const reviewersData = await reviewersResponse.json();
        recipients = reviewersData
          .map((r: any) => r.email)
          .filter(Boolean);
      }
    } else if (input.recipientType === "custom" && input.customEmails) {
      recipients = input.customEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
    }

    if (recipients.length === 0) {
      return {
        success: false,
        error: "No recipients found for the email",
      };
    }

    // Build email body
    let emailBody = input.body;

    // Add application link if requested
    if (input.includeApplicationLink === "true") {
      const portalResponse = await fetch(
        `${apiUrl}/api/v1/forms/${formId}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(credentials.MATIC_API_KEY && {
              Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
            }),
          },
        }
      );

      if (portalResponse.ok) {
        const formData = await portalResponse.json();
        const portalUrl = formData.portal_url || formData.custom_url;
        if (portalUrl) {
          emailBody += `\n\n---\nView your application: ${portalUrl}/applications/${input.applicationId}`;
        }
      }
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
        to: recipients,
        subject: input.subject,
        body: emailBody,
        html_body: emailBody.replace(/\n/g, "<br>"),
        application_id: input.applicationId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to send email: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.message_id || data.id || "",
      sentTo: recipients.join(", "),
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Email send failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function sendEmailStep(
  input: SendEmailInput
): Promise<SendEmailResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticEmailCredentials));
}
sendEmailStep.maxRetries = 0;

export const _integrationType = "matic-email";
