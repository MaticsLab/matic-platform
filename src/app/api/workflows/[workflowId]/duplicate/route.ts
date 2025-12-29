import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { duplicateWorkflow } from "@/lib/db/workflow-db";

export async function POST(
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

    const duplicatedWorkflow = await duplicateWorkflow(workflowId, session.user.id);

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
