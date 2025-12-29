import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { getWorkflows } from "@/lib/db/workflow-db";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json([], { status: 200 });
    }

    const userWorkflows = await getWorkflows(session.user.id);

    const mappedWorkflows = userWorkflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      edges: workflow.edges,
      visibility: workflow.visibility,
      createdAt: workflow.created_at.toISOString(),
      updatedAt: workflow.updated_at.toISOString(),
    }));

    return NextResponse.json(mappedWorkflows);
  } catch (error) {
    console.error("Failed to get workflows:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get workflows",
      },
      { status: 500 }
    );
  }
}
