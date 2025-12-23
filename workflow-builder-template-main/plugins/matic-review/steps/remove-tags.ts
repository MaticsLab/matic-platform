import "server-only";

import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type RemoveTagsResult =
  | { success: true; data: { applicationId: string; tags: string[] } }
  | { success: false; error: { message: string } };

export type RemoveTagsCoreInput = {
  applicationId: string;
  tags: string;
};

export type RemoveTagsInput = StepInput &
  RemoveTagsCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for removing tags from an application
 */
async function stepHandler(
  input: RemoveTagsCoreInput,
  credentials: MaticReviewCredentials
): Promise<RemoveTagsResult> {
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

  if (!input.tags) {
    return {
      success: false,
      error: { message: "Tags are required." },
    };
  }

  // Parse comma-separated tags
  const tagsToRemove = input.tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tagsToRemove.length === 0) {
    return {
      success: false,
      error: { message: "No valid tags provided." },
    };
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}/tags`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
        body: JSON.stringify({
          tags: tagsToRemove,
          action: "remove",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { message: `Failed to remove tags: ${errorText}` },
      };
    }

    const result = await response.json();

    return {
      success: true,
      data: {
        applicationId: input.applicationId,
        tags: result.tags || [],
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
export async function removeTagsStep(
  input: RemoveTagsInput
): Promise<RemoveTagsResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
removeTagsStep.maxRetries = 0;

export const _integrationType = "matic-review";
