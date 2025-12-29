import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { getIntegrations, createIntegration } from "@/lib/db/workflow-db";
import type {
  IntegrationConfig,
  IntegrationType,
} from "@/lib/types/integration";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type GetIntegrationsResponse = {
  id: string;
  name: string;
  type: IntegrationType;
  isManaged?: boolean;
  createdAt: string;
  updatedAt: string;
  // Config is intentionally excluded for security
}[];

export type CreateIntegrationRequest = {
  name?: string;
  type: IntegrationType;
  config: IntegrationConfig;
};

export type CreateIntegrationResponse = {
  id: string;
  name: string;
  type: IntegrationType;
  createdAt: string;
  updatedAt: string;
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
 * GET /api/integrations
 * List all integrations for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get optional type filter from query params
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") as IntegrationType | null;

    const integrations = await getIntegrations(
      user.id,
      typeFilter || undefined
    );

    // Return integrations without config for security
    const response: GetIntegrationsResponse = integrations.map(
      (integration) => ({
        id: integration.id,
        name: integration.name,
        type: integration.type,
        isManaged: integration.is_managed ?? false,
        createdAt: integration.created_at.toISOString(),
        updatedAt: integration.updated_at.toISOString(),
      })
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get integrations:", error);
    return NextResponse.json(
      {
        error: "Failed to get integrations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations
 * Create a new integration
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateIntegrationRequest = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    // Ensure config is a valid object (default to empty object)
    const config = body.config || {};

    const integration = await createIntegration(
      user.id,
      body.name || "",
      body.type,
      config
    );

    const response: CreateIntegrationResponse = {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      createdAt: integration.created_at.toISOString(),
      updatedAt: integration.updated_at.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to create integration:", error);
    return NextResponse.json(
      {
        error: "Failed to create integration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
