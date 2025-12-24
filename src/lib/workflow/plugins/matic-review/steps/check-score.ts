
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type CheckScoreResult =
  | {
      success: true;
      data: {
        passes: boolean;
        averageScore: number | null;
        reviewCount: number;
        threshold: number;
        operator: string;
      };
    }
  | { success: false; error: { message: string } };

export type CheckScoreCoreInput = {
  applicationId: string;
  operator: ">=" | ">" | "<=" | "<" | "==";
  threshold: number;
  minReviews?: number;
};

export type CheckScoreInput = StepInput &
  CheckScoreCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for checking application scores
 */
async function stepHandler(
  input: CheckScoreCoreInput,
  credentials: MaticReviewCredentials
): Promise<CheckScoreResult> {
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

  const minReviews = input.minReviews ?? 1;

  try {
    // Fetch application to get scores
    const response = await fetch(
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

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { message: `Failed to fetch application: ${errorText}` },
      };
    }

    const app = await response.json();
    const metadata = app.metadata || {};
    const scores = metadata.scores || {};

    // Calculate average score
    const scoreValues = Object.values(scores).filter(
      (v): v is number => typeof v === "number"
    );
    const reviewCount = scoreValues.length;
    const averageScore =
      reviewCount > 0
        ? scoreValues.reduce((a, b) => a + b, 0) / reviewCount
        : null;

    // Check if we have minimum reviews
    if (reviewCount < minReviews) {
      return {
        success: true,
        data: {
          passes: false,
          averageScore,
          reviewCount,
          threshold: input.threshold,
          operator: input.operator,
        },
      };
    }

    // Evaluate the condition
    let passes = false;
    if (averageScore !== null) {
      switch (input.operator) {
        case ">=":
          passes = averageScore >= input.threshold;
          break;
        case ">":
          passes = averageScore > input.threshold;
          break;
        case "<=":
          passes = averageScore <= input.threshold;
          break;
        case "<":
          passes = averageScore < input.threshold;
          break;
        case "==":
          passes = averageScore === input.threshold;
          break;
      }
    }

    return {
      success: true,
      data: {
        passes,
        averageScore,
        reviewCount,
        threshold: input.threshold,
        operator: input.operator,
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
export async function checkScoreStep(
  input: CheckScoreInput
): Promise<CheckScoreResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
checkScoreStep.maxRetries = 0;

export const _integrationType = "matic-review";
