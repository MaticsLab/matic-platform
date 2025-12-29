import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { getWorkflowByUser } from "@/lib/db/workflow-db";

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

    const workflow = await getWorkflowByUser(workflowId, session.user.id);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Generate simple code representation
    // In production, this would use a proper code generator
    const code = generateWorkflowCode(
      workflow.name,
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[]
    );

    return NextResponse.json({
      code,
      workflowName: workflow.name,
    });
  } catch (error) {
    console.error("Failed to get workflow code:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get workflow code",
      },
      { status: 500 }
    );
  }
}

// Simple types for code generation
type WorkflowNode = {
  id: string;
  type: string;
  data?: {
    label?: string;
    type?: string;
    config?: Record<string, unknown>;
  };
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

// Simple code generator - in production this would be more sophisticated
function generateWorkflowCode(
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string {
  const functionName = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("") || "execute";

  const lines: string[] = [
    `// ${name} Workflow`,
    `// Generated code - modify as needed`,
    ``,
    `export async function ${functionName}Workflow(input: Record<string, unknown>) {`,
    `  console.log("Starting workflow: ${name}");`,
    `  console.log("Input:", input);`,
    ``,
  ];

  // Add node execution comments
  for (const node of nodes) {
    const nodeType = node.data?.type || node.type;
    const nodeLabel = node.data?.label || node.id;
    lines.push(`  // Node: ${nodeLabel} (${nodeType})`);
    lines.push(`  // TODO: Implement ${nodeType} logic`);
    lines.push(``);
  }

  lines.push(`  return { success: true };`);
  lines.push(`}`);

  return lines.join("\n");
}
