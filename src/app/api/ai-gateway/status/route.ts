import { NextResponse } from "next/server";
import { optionalAuth } from "@/lib/api-auth";

export type AiGatewayStatusResponse = {
  enabled: boolean;
  signedIn: boolean;
  isVercelUser: boolean;
  hasManagedKey: boolean;
  managedIntegrationId?: string;
};

// AI Gateway status - placeholder implementation
export async function GET(request: Request) {
  try {
    const authContext = await optionalAuth(request);

    // Return basic status
    // In production, this would check for Vercel AI Gateway setup
    const response: AiGatewayStatusResponse = {
      enabled: false,  // AI Gateway not enabled by default
      signedIn: !!authContext,
      isVercelUser: false,
      hasManagedKey: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get AI gateway status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
