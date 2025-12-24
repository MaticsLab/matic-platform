
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type AssignReviewersResult =
  | {
      success: true;
      data: { applicationId: string; assignedCount: number; reviewers: string[] };
    }
  | { success: false; error: { message: string } };

export type AssignReviewersCoreInput = {
  applicationId: string;
  reviewerTypeId?: string;
  reviewerIds?: string;
  autoAssign?: string;
};

export type AssignReviewersInput = StepInput &
  AssignReviewersCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for assigning reviewers to an application
 */
async function stepHandler(
  input: AssignReviewersCoreInput,
  credentials: MaticReviewCredentials
): Promise<AssignReviewersResult> {
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

  // Parse reviewer IDs if provided
  const reviewerIds = input.reviewerIds
    ? input.reviewerIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

  const autoAssign = input.autoAssign === "true";

  if (!reviewerIds.length && !input.reviewerTypeId && !autoAssign) {
    return {
      success: false,
      error: {
        message:
          "Either reviewer IDs, reviewer type, or auto-assign must be specified.",
      },
    };
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/forms/${formId}/submissions/${input.applicationId}/reviewers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
        body: JSON.stringify({
          reviewer_type_id: input.reviewerTypeId,
          reviewer_ids: reviewerIds,
          auto_assign: autoAssign,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { message: `Failed to assign reviewers: ${errorText}` },
      };
    }

    const result = await response.json();

    return {
      success: true,
      data: {
        applicationId: input.applicationId,
        assignedCount: result.assigned_count || reviewerIds.length,
        reviewers: result.reviewers || reviewerIds,
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
export async function assignReviewersStep(
  input: AssignReviewersInput
): Promise<AssignReviewersResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
assignReviewersStep.maxRetries = 0;

export const _integrationType = "matic-review";
