
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type SetStatusResult =
  | { success: true; data: { applicationId: string; status: string } }
  | { success: false; error: { message: string } };

export type SetStatusCoreInput = {
  applicationId: string;
  status: string;
  comment?: string;
};

export type SetStatusInput = StepInput &
  SetStatusCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for setting application status
 */
async function stepHandler(
  input: SetStatusCoreInput,
  credentials: MaticReviewCredentials
): Promise<SetStatusResult> {
  const apiUrl = credentials.MATIC_API_URL;
  const formId = credentials.MATIC_FORM_ID;

  if (!apiUrl) {
    return {
      success: false,
      error: { message: "MATIC_API_URL is not configured." },
    };
  }

  if (!input.applicationId) {
    return {
      success: false,
      error: { message: "Application ID is required." },
    };
  }

  if (!input.status) {
    return {
      success: false,
      error: { message: "Status is required." },
    };
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
        body: JSON.stringify({
          status: input.status,
          comment: input.comment,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { message: `Failed to set status: ${errorText}` },
      };
    }

    return {
      success: true,
      data: {
        applicationId: input.applicationId,
        status: input.status,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
}

/**
 * Entry point with logging
 */
export async function setStatusStep(
  input: SetStatusInput
): Promise<SetStatusResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
setStatusStep.maxRetries = 0;

export const _integrationType = "matic-review";
