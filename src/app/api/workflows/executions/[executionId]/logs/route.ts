import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import {
  getExecution,
  getExecutionLogs,
  getExecutionWithWorkflow,
} from "@/lib/db/workflow-db";

export async function GET(
  request: Request,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the execution with workflow
    const result = await getExecutionWithWorkflow(executionId);

    if (!result) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    // Verify the workflow belongs to the user
    if (result.workflow.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get logs
    const logs = await getExecutionLogs(executionId);

    return NextResponse.json({
      execution: {
        id: result.execution.id,
        workflowId: result.execution.workflow_id,
        userId: result.execution.user_id,
        status: result.execution.status,
        input: result.execution.trigger_data,
        output: result.execution.output,
        error: result.execution.error,
        startedAt: result.execution.started_at,
        completedAt: result.execution.completed_at,
        duration: result.execution.duration?.toString(),
        workflow: {
          id: result.workflow.id,
          name: result.workflow.name,
          nodes: result.workflow.nodes,
          edges: result.workflow.edges,
        },
      },
      logs: logs.map((log) => ({
        id: log.id,
        executionId: log.execution_id,
        nodeId: log.node_id,
        nodeName: log.node_label,
        nodeType: log.node_type,
        status: log.status,
        input: log.input,
        output: log.output,
        error: log.error,
        startedAt: log.started_at,
        completedAt: log.completed_at,
        duration: log.duration?.toString(),
      })),
    });
  } catch (error) {
    console.error("Failed to get execution logs:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get execution logs",
      },
      { status: 500 }
    );
  }
}
