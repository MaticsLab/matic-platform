import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import {
  getWorkflowByUser,
  getExecutions,
  deleteExecutions,
} from "@/lib/db/workflow-db";

export async function GET(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workflow ownership
    const workflow = await getWorkflowByUser(workflowId, session.user.id);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Fetch executions
    const executions = await getExecutions(workflowId);

    return NextResponse.json(
      executions.map((e) => ({
        id: e.id,
        workflowId: e.workflow_id,
        userId: e.user_id,
        status: e.status,
        input: e.trigger_data,
        output: e.output,
        error: e.error,
        startedAt: e.started_at,
        completedAt: e.completed_at,
        duration: e.duration?.toString(),
      }))
    );
  } catch (error) {
    console.error("Failed to get executions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get executions",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workflow ownership
    const workflow = await getWorkflowByUser(workflowId, session.user.id);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Delete all executions for this workflow
    const deletedCount = await deleteExecutions(workflowId);

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error("Failed to delete executions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete executions",
      },
      { status: 500 }
    );
  }
}
