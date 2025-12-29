import { NextResponse } from "next/server";
import {
  getWorkflow,
  createExecution,
  updateExecution,
  validateApiKey,
  validateWorkflowIntegrations,
} from "@/lib/db/workflow-db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;

    // Get workflow
    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Validate API key
    const authHeader = request.headers.get("Authorization");
    const apiKeyResult = await validateApiKeyForWebhook(authHeader, workflow.user_id);

    if (!apiKeyResult.valid) {
      return NextResponse.json(
        { error: apiKeyResult.error },
        { status: apiKeyResult.statusCode || 401, headers: corsHeaders }
      );
    }

    // Validate that all integrationIds in workflow nodes belong to the workflow owner
    const validation = await validateWorkflowIntegrations(
      workflow.nodes as Array<{ data?: { config?: { integrationId?: string } } }>,
      workflow.user_id
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Workflow contains invalid integration references" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get input from request body
    const input = await request.json().catch(() => ({}));

    // Create execution record
    const execution = await createExecution(workflowId, workflow.user_id, input);

    // Update to running status
    await updateExecution(execution.id, { status: "running" });

    // TODO: Implement actual workflow execution
    // For now, mark as completed immediately
    await updateExecution(execution.id, {
      status: "completed",
      completedAt: new Date(),
      duration: 0,
    });

    return NextResponse.json(
      {
        executionId: execution.id,
        status: "completed",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to trigger webhook:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to trigger webhook",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Validate API key for webhook and ensure it belongs to workflow owner
async function validateApiKeyForWebhook(
  authHeader: string | null,
  workflowUserId: string
): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
  if (!authHeader) {
    return {
      valid: false,
      error: "Missing Authorization header",
      statusCode: 401,
    };
  }

  // Support "Bearer <key>" format
  const key = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!key?.startsWith("wfb_")) {
    return { valid: false, error: "Invalid API key format", statusCode: 401 };
  }

  // Validate and get API key info
  const apiKeyResult = await validateApiKey(key);

  if (!apiKeyResult) {
    return { valid: false, error: "Invalid API key", statusCode: 401 };
  }

  // Verify the API key belongs to the workflow owner
  if (apiKeyResult.userId !== workflowUserId) {
    return {
      valid: false,
      error: "You do not have permission to run this workflow",
      statusCode: 403,
    };
  }

  return { valid: true };
}
