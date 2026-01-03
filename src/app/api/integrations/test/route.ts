import { NextResponse } from "next/server";
import { Pool } from "pg";
import { requireAuth } from "@/lib/api-auth";
import type {
  IntegrationConfig,
  IntegrationType,
} from "@/lib/types/integration";
import { getIntegration } from "@/lib/workflow/plugins";

export type TestConnectionRequest = {
  type: IntegrationType;
  config: IntegrationConfig;
};

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

/**
 * POST /api/integrations/test
 * Test connection credentials without saving
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const body: TestConnectionRequest = await request.json();

    if (!body.type) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    // Ensure config is a valid object (default to empty object)
    const config = body.config || {};

    // Test database connection
    if (body.type === "database") {
      const result = await testDatabaseConnection(config.url);
      return NextResponse.json(result);
    }

    // Get plugin and test function
    const plugin = getIntegration(body.type);
    
    // For auto-connect integrations, always return success (no credentials to test)
    if (plugin?.autoConnect) {
      return NextResponse.json({
        status: "success",
        message: "Auto-connect integration - no credentials needed",
      });
    }
    
    if (plugin?.testConfig?.getTestFunction) {
      // Convert config to credentials format expected by test function
      // The test function expects env var names like RESEND_API_KEY
      const credentials: Record<string, string> = {};
      for (const field of plugin.formFields) {
        const value = config[field.configKey];
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

    // For integrations without test functions, return a validation message
    const result: TestConnectionResult = {
      status: "success",
      message: "Configuration looks valid. Connection not tested.",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test connection:", error);
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to test connection",
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
