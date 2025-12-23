import "server-only";

import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { MaticReviewCredentials } from "../credentials";

type GetApplicationResult =
  | {
      success: true;
      data: {
        id: string;
        data: Record<string, unknown>;
        status: string;
        stageId: string | null;
        stageName: string | null;
        submittedAt: string;
        applicantEmail: string | null;
        applicantName: string | null;
        scores: Record<string, number>;
        averageScore: number | null;
        tags: string[];
      };
    }
  | { success: false; error: { message: string } };

export type GetApplicationCoreInput = {
  applicationId: string;
};

export type GetApplicationInput = StepInput &
  GetApplicationCoreInput & {
    integrationId?: string;
  };

/**
 * Core logic for fetching application data
 */
async function stepHandler(
  input: GetApplicationCoreInput,
  credentials: MaticReviewCredentials
): Promise<GetApplicationResult> {
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

  try {
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
    const data = app.data || {};

    // Extract applicant info from common field patterns
    const applicantEmail =
      data.email ||
      data.Email ||
      data.emailAddress ||
      data["Email Address"] ||
      null;
    const applicantName =
      data.name ||
      data.Name ||
      data.fullName ||
      data["Full Name"] ||
      data.studentName ||
      null;

    // Calculate average score
    const scores = metadata.scores || {};
    const scoreValues = Object.values(scores).filter(
      (v): v is number => typeof v === "number"
    );
    const averageScore =
      scoreValues.length > 0
        ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
        : null;

    return {
      success: true,
      data: {
        id: app.id,
        data: data,
        status: app.status || metadata.status || "pending",
        stageId: metadata.current_stage_id || null,
        stageName: metadata.current_stage_name || null,
        submittedAt: app.submitted_at || app.created_at,
        applicantEmail,
        applicantName,
        scores,
        averageScore,
        tags: metadata.tags || [],
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
export async function getApplicationStep(
  input: GetApplicationInput
): Promise<GetApplicationResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials as MaticReviewCredentials));
}
getApplicationStep.maxRetries = 0;

export const _integrationType = "matic-review";
