import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import {
  getWorkflow,
  getExecutions,
  deleteExecutions,
} from "@/lib/db/workflow-db";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Get authenticated user from either Better Auth or Supabase
 */
async function getAuthUser(request: Request) {
  // Try Better Auth first
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user) {
      return { id: session.user.id, email: session.user.email };
    }
  } catch (error) {
    console.debug("[Executions API] Better Auth session not found");
  }

  // Fall back to Supabase
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      return { id: user.id, email: user.email! };
    }
  } catch (error) {
    console.debug("[Executions API] Supabase session not found");
  }

  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workflow exists (check ownership via user_id match)
    const workflow = await getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Check ownership - workflow must belong to this user
    if (workflow.user_id !== user.id) {
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
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workflow exists and ownership
    const workflow = await getWorkflow(workflowId);

    if (!workflow || workflow.user_id !== user.id) {
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
