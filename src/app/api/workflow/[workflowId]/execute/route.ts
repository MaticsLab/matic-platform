import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import {
  getWorkflow,
  createExecution,
  updateExecution,
  validateWorkflowIntegrations,
} from "@/lib/db/workflow-db";

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;

    // Get session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get workflow
    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    if (workflow.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate that all integrationIds in workflow nodes belong to the current user
    const validation = await validateWorkflowIntegrations(
      workflow.nodes as Array<{ data?: { config?: { integrationId?: string } } }>,
      session.user.id
    );
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Workflow contains invalid integration references",
          invalidIds: validation.invalidIds,
        },
        { status: 400 }
      );
    }

    // Get input from request body
    const body = await request.json().catch(() => ({}));
    const input = body.input || {};

    // Create execution record
    const execution = await createExecution(workflowId, session.user.id, input);

    // Update execution to running status
    await updateExecution(execution.id, { status: "running" });

    // TODO: Implement actual workflow execution logic
    // For now, we'll just mark it as completed immediately
    // In a real implementation, this would:
    // 1. Parse nodes and edges
    // 2. Execute each node in order based on edges
    // 3. Track node execution logs
    // 4. Handle errors and retries

    // Simulate completion
    await updateExecution(execution.id, {
      status: "completed",
      completedAt: new Date(),
      duration: 0,
    });

    return NextResponse.json({
      executionId: execution.id,
      status: "completed",
      output: null,
      duration: 0,
    });
  } catch (error) {
    console.error("Failed to execute workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to execute workflow",
      },
      { status: 500 }
    );
  }
}
