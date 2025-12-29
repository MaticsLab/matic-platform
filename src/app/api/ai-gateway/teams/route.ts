import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";

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
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
