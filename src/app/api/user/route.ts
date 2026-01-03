import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getUser, updateUser, getUserAccount } from "@/lib/db/workflow-db";

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;
    const userData = await getUser(user.id);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the user's account to determine auth provider
    const userAccount = await getUserAccount(user.id);

    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      image: userData.image,
      isAnonymous: false,
      providerId: userAccount?.provider_id ?? null,
    });
  } catch (error) {
    console.error("Failed to get user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get user",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult.context;

    // Check if user is an OAuth user (can't update profile for OAuth users)
    const userAccount = await getUserAccount(user.id);

    // Block updates for OAuth users (vercel, github, google, etc.)
    const oauthProviders = ["vercel", "github", "google"];
    if (userAccount && oauthProviders.includes(userAccount.provider_id)) {
      return NextResponse.json(
        { error: "Cannot update profile for OAuth users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: { name?: string; email?: string } = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.email !== undefined) {
      updates.email = body.email;
    }

    await updateUser(user.id, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update user",
      },
      { status: 500 }
    );
  }
}
