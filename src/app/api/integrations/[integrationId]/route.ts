import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
} from "@/lib/db/workflow-db";
import type { IntegrationConfig } from "@/lib/types/integration";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type GetIntegrationResponse = {
  id: string;
  name: string;
  type: string;
  config: IntegrationConfig;
  createdAt: string;
  updatedAt: string;
};

export type UpdateIntegrationRequest = {
  name?: string;
  config?: IntegrationConfig;
};

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
    console.debug("[Integrations API] Better Auth session not found");
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
    console.debug("[Integrations API] Supabase session not found");
  }

  return null;
}

/**
 * GET /api/integrations/[integrationId]
 * Get a single integration with decrypted config
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await getIntegration(integrationId, user.id);

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    const response: GetIntegrationResponse = {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      config: integration.config,
      createdAt: integration.created_at.toISOString(),
      updatedAt: integration.updated_at.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get integration:", error);
    return NextResponse.json(
      {
        error: "Failed to get integration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/integrations/[integrationId]
 * Update an integration
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateIntegrationRequest = await request.json();

    const integration = await updateIntegration(
      integrationId,
      user.id,
      body
    );

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    const response: GetIntegrationResponse = {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      config: integration.config,
      createdAt: integration.created_at.toISOString(),
      updatedAt: integration.updated_at.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to update integration:", error);
    return NextResponse.json(
      {
        error: "Failed to update integration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/[integrationId]
 * Delete an integration
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const success = await deleteIntegration(integrationId, user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete integration:", error);
    return NextResponse.json(
      {
        error: "Failed to delete integration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
