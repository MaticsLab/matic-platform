
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type MoveToStageResult =
  | { success: true; data: { applicationId: string; stageId: string; stageName: string } }
  | { success: false; error: { message: string } };

export type MoveToStageCoreInput = {
  applicationId: string;
  stageId: string;
  reason?: string;
};

export type MoveToStageInput = StepInput &
  MoveToStageCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for moving an application to a stage
 */
async function stepHandler(
  input: MoveToStageCoreInput,
  credentials: MaticReviewCredentials
): Promise<MoveToStageResult> {
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

  if (!input.stageId) {
    return {
      success: false,
      error: { message: "Target stage ID is required." },
    };
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}/stage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
        body: JSON.stringify({
          stage_id: input.stageId,
          reason: input.reason,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { message: `Failed to move application: ${errorText}` },
      };
    }

    const result = await response.json();

    return {
      success: true,
      data: {
        applicationId: input.applicationId,
        stageId: input.stageId,
        stageName: result.stage_name || input.stageId,
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
export async function moveToStageStep(
  input: MoveToStageInput
): Promise<MoveToStageResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
moveToStageStep.maxRetries = 0;

export const _integrationType = "matic-review";
