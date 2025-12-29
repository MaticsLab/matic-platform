import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { getApiKeys, createApiKey, generateApiKey } from "@/lib/db/workflow-db";

// GET - List all API keys for the current user
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await getApiKeys(session.user.id);

    return NextResponse.json(
      keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.key_prefix,
        createdAt: key.created_at,
        lastUsedAt: key.last_used_at,
      }))
    );
  } catch (error) {
    console.error("Failed to list API keys:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

// POST - Create a new API key
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is anonymous
    const isAnonymous =
      session.user.name === "Anonymous" ||
      session.user.email?.startsWith("temp-");

    if (isAnonymous) {
      return NextResponse.json(
        { error: "Anonymous users cannot create API keys" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name || null;

    // Create new API key
    const newKey = await createApiKey(session.user.id, name);

    // Return the full key only on creation (won't be shown again)
    return NextResponse.json({
      id: newKey.id,
      name: newKey.name,
      keyPrefix: newKey.key_prefix,
      createdAt: newKey.created_at,
      key: newKey.key, // Full key - only returned once!
    });
  } catch (error) {
    console.error("Failed to create API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
