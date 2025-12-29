import { NextResponse } from "next/server";
import { Pool } from "pg";
import { auth } from "@/lib/better-auth";
import { getIntegration as getDbIntegration } from "@/lib/db/workflow-db";
import { getIntegration as getPluginIntegration } from "@/lib/workflow/plugins";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrationId } = await context.params;

    if (!integrationId) {
      return NextResponse.json(
        { error: "integrationId is required" },
        { status: 400 }
      );
    }

    const integration = await getDbIntegration(integrationId, user.id);

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Test database connection
    if (integration.type === "database") {
      const result = await testDatabaseConnection(integration.config.url);
      return NextResponse.json(result);
    }

    // Get plugin and test function
    const plugin = getPluginIntegration(integration.type);
    if (plugin?.testConfig?.getTestFunction) {
      // Convert config to credentials format expected by test function
      const credentials: Record<string, string> = {};
      for (const field of plugin.formFields) {
        const value = integration.config[field.configKey];
        if (value && field.envVar) {
          credentials[field.envVar] = value as string;
        }
      }
      
      // Get the test function and run it
      const testFunction = await plugin.testConfig.getTestFunction();
      const testResult = await testFunction(credentials);
      
      if (testResult.success) {
        return NextResponse.json({
          status: "success",
          message: "Connection successful",
        });
      } else {
        return NextResponse.json({
          status: "error",
          message: testResult.error || "Connection test failed",
        });
      }
    }

    // For other integration types without test functions
    const result: TestConnectionResult = {
      status: "success",
      message: "Integration exists. Specific connection test not implemented.",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test integration:", error);
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to test integration",
      },
      { status: 500 }
    );
  }
}

async function testDatabaseConnection(
  databaseUrl?: string
): Promise<TestConnectionResult> {
  let pool: Pool | null = null;

  try {
    if (!databaseUrl) {
      return {
        status: "error",
        message: "Database URL is required",
      };
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("supabase") || databaseUrl.includes("ssl=true")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    return {
      status: "success",
      message: "Connection successful",
    };
  } catch (error) {
    console.error("Database connection test failed:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
