import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  createWorkflow,
  getWorkflowCount,
  validateWorkflowIntegrations,
  generateId,
} from "@/lib/db/workflow-db";

// Helper function to create a default trigger node
function createDefaultTriggerNode() {
  return {
    id: generateId(),
    type: "trigger" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "",
      description: "",
      type: "trigger" as const,
      config: { triggerType: "Manual" },
      status: "idle" as const,
    },
  };
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;

    const body = await request.json();

    if (!(body.name && body.nodes && body.edges)) {
      return NextResponse.json(
        { error: "Name, nodes, and edges are required" },
        { status: 400 }
      );
    }

    // Validate that all integrationIds in nodes belong to the current user
    const validation = await validateWorkflowIntegrations(
      body.nodes,
      user.id
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid integration references in workflow" },
        { status: 403 }
      );
    }

    // Ensure there's always a trigger node (only add one if nodes array is empty)
    let nodes = body.nodes;
    if (nodes.length === 0) {
      nodes = [createDefaultTriggerNode()];
    }

    // Generate "Untitled N" name if the provided name is "Untitled Workflow"
    let workflowName = body.name;
    if (body.name === "Untitled Workflow") {
      const count = await getWorkflowCount(user.id);
      workflowName = `Untitled ${count + 1}`;
    }

    // Use the workspace_id from body or default to user's default workspace
    const workspaceId = body.workspaceId || body.workspace_id || user.id;

    const newWorkflow = await createWorkflow(user.id, workspaceId, {
      name: workflowName,
      description: body.description,
      nodes,
      edges: body.edges,
      visibility: body.visibility || "private",
    });

    return NextResponse.json({
      id: newWorkflow.id,
      name: newWorkflow.name,
      description: newWorkflow.description,
      nodes: newWorkflow.nodes,
      edges: newWorkflow.edges,
      visibility: newWorkflow.visibility,
      createdAt: newWorkflow.created_at.toISOString(),
      updatedAt: newWorkflow.updated_at.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create workflow:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create workflow",
      },
      { status: 500 }
    );
  }
}
