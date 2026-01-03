import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getWorkflowByUser } from "@/lib/db/workflow-db";

export async function GET(
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

    const workflow = await getWorkflowByUser(workflowId, user.id);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Generate downloadable files
    // In production, this would generate a full project structure
    const files: Record<string, string> = {};

    // Generate main workflow file
    const functionName = workflow.name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join("") || "execute";

    files["workflow.ts"] = generateWorkflowCode(
      workflow.name,
      workflow.nodes as WorkflowNode[],
      workflow.edges as WorkflowEdge[]
    );

    files["workflow.json"] = JSON.stringify(
      {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
      },
      null,
      2
    );

    files["package.json"] = JSON.stringify(
      {
        name: functionName.toLowerCase() + "-workflow",
        version: "1.0.0",
        description: workflow.description || workflow.name,
        main: "workflow.ts",
        scripts: {
          start: "ts-node workflow.ts",
        },
        dependencies: {
          typescript: "^5.0.0",
          "ts-node": "^10.0.0",
        },
      },
      null,
      2
    );

    files["README.md"] = `# ${workflow.name}

Generated workflow from Matic Platform.

## Files

- \`workflow.ts\` - Main workflow code
- \`workflow.json\` - Workflow definition (nodes and edges)

## Usage

\`\`\`bash
npm install
npm start
\`\`\`
`;

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error("Failed to download workflow:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download workflow",
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

  for (const node of nodes) {
    const nodeType = node.data?.type || node.type;
    const nodeLabel = node.data?.label || node.id;
    lines.push(`  // Node: ${nodeLabel} (${nodeType})`);
    lines.push(`  // TODO: Implement ${nodeType} logic`);
    lines.push(``);
  }

  lines.push(`  return { success: true };`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Run if executed directly`);
  lines.push(`if (require.main === module) {`);
  lines.push(`  ${functionName}Workflow({}).then(console.log).catch(console.error);`);
  lines.push(`}`);

  return lines.join("\n");
}
