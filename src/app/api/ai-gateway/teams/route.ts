import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export type VercelTeam = {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
  isPersonal: boolean;
};

export type AiGatewayTeamsResponse = {
  teams: VercelTeam[];
};

// AI Gateway teams - placeholder implementation
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    // Return empty teams list
    // In production, this would fetch Vercel teams via OAuth
    const response: AiGatewayTeamsResponse = {
      teams: [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get teams:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get teams",
      },
      { status: 500 }
    );
  }
}
