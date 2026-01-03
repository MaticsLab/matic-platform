import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { duplicateWorkflow } from "@/lib/db/workflow-db";

export async function POST(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;

    const duplicatedWorkflow = await duplicateWorkflow(workflowId, user.id);

    if (!duplicatedWorkflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: duplicatedWorkflow.id,
      name: duplicatedWorkflow.name,
      description: duplicatedWorkflow.description,
      nodes: duplicatedWorkflow.nodes,
      edges: duplicatedWorkflow.edges,
      visibility: duplicatedWorkflow.visibility,
      createdAt: duplicatedWorkflow.created_at.toISOString(),
      updatedAt: duplicatedWorkflow.updated_at.toISOString(),
    });
  } catch (error) {
    console.error("Failed to duplicate workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to duplicate workflow",
      },
      { status: 500 }
    );
  }
}
