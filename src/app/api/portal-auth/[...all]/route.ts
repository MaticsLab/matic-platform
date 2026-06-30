import { getPortalAuth } from "@/auth/server/portal";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

let _handlers: ReturnType<typeof toNextJsHandler> | null = null;

function getHandlers() {
  if (!_handlers) {
    _handlers = toNextJsHandler(getPortalAuth());
  }
  return _handlers;
}

export async function GET(request: NextRequest) {
  try {
    return await getHandlers().GET(request);
  } catch (error: any) {
    console.error("[Portal Auth] GET error:", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await getHandlers().POST(request);
  } catch (error: any) {
    console.error("[Portal Auth] POST error:", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
