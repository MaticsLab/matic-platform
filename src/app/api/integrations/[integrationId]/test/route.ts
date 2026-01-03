import { NextResponse } from "next/server";
import { Pool } from "pg";
import { requireAuth } from "@/lib/api-auth";
import { getIntegration as getDbIntegration } from "@/lib/db/workflow-db";
import { getIntegration as getPluginIntegration } from "@/lib/workflow/plugins";

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
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
