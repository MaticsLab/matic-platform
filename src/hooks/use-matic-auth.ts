"use client";

import { useEffect, useState, useCallback } from "react";

interface MaticAuthContext {
  token: string | null;
  workspaceId: string | null;
  formId: string | null;
  isEmbedded: boolean;
  hasMounted: boolean;
}

const defaultContext: MaticAuthContext = {
  token: null,
  workspaceId: null,
  formId: null,
  isEmbedded: false,
  hasMounted: false,
};

export function useMaticAuth(): MaticAuthContext {
  const [authContext, setAuthContext] = useState<MaticAuthContext>(defaultContext);

  // Parse URL parameters on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const embedded = url.searchParams.get("embedded") === "true";
    const workspaceId = url.searchParams.get("workspace_id");
    const formId = url.searchParams.get("form_id");

    // Check hash for token (more secure than query param)
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const token = hashParams.get("token");

    setAuthContext({
      token,
      workspaceId,
      formId,
      isEmbedded: embedded,
      hasMounted: true,
    });
  }, []);

  // Listen for postMessage from parent frame
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      // Validate origin - in production, check against allowed origins
      // For now, accept messages from any origin in development
      if (process.env.NODE_ENV === "production") {
        const allowedOrigins = [
          process.env.NEXT_PUBLIC_MATIC_PLATFORM_URL,
          "https://matic.so",
          "https://app.matic.so",
        ].filter(Boolean);

        if (!allowedOrigins.includes(event.origin)) {
          console.warn("Received message from unauthorized origin:", event.origin);
          return;
        }
      }

      // Handle Matic auth messages
      if (event.data?.type === "MATIC_AUTH") {
        setAuthContext((prev) => ({
          ...prev,
          token: event.data.token || prev.token,
          workspaceId: event.data.workspaceId || prev.workspaceId,
          formId: event.data.formId || prev.formId,
          isEmbedded: true,
        }));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return authContext;
}

// Helper to check if we're in embedded mode
export function isEmbeddedMode(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.searchParams.get("embedded") === "true";
}

// Helper to get workspace context for API calls
export function getMaticContext(): { workspaceId: string | null; formId: string | null } {
  if (typeof window === "undefined") {
    return { workspaceId: null, formId: null };
  }

  const url = new URL(window.location.href);
  return {
    workspaceId: url.searchParams.get("workspace_id"),
    formId: url.searchParams.get("form_id"),
  };
}
