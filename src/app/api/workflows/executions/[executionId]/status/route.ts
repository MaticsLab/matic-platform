import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { getExecutionWithWorkflow, getExecutionLogs } from "@/lib/db/workflow-db";

type NodeStatus = {
  nodeId: string;
  status: "pending" | "running" | "success" | "error";
};

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

    // Get logs for all nodes
    const logs = await getExecutionLogs(executionId);

    // Map logs to node statuses
    const nodeStatuses: NodeStatus[] = logs.map((log) => ({
      nodeId: log.node_id,
      status: log.status as NodeStatus["status"],
    }));

    return NextResponse.json({
      status: result.execution.status,
      nodeStatuses,
    });
  } catch (error) {
    console.error("Failed to get execution status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get execution status",
      },
      { status: 500 }
    );
  }
}
