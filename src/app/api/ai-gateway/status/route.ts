import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";

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
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Return basic status
    // In production, this would check for Vercel AI Gateway setup
    const response: AiGatewayStatusResponse = {
      enabled: false,  // AI Gateway not enabled by default
      signedIn: !!session?.user,
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
