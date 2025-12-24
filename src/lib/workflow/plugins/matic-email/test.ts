export async function testMaticEmail(
  credentials: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = credentials.MATIC_API_URL;
  const workspaceId = credentials.MATIC_WORKSPACE_ID;

  if (!apiUrl) {
    return {
      success: false,
      error: "MATIC_API_URL is not configured.",
    };
  }

  if (!workspaceId) {
    return {
      success: false,
      error: "MATIC_WORKSPACE_ID is not configured.",
    };
  }

  try {
    // Test connection by checking email connection status
    const response = await fetch(
      `${apiUrl}/api/v1/email/status?workspace_id=${workspaceId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(credentials.MATIC_API_KEY && {
            Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
          }),
        },
      }
    );

    if (!response.ok) {
      // Check if it's a 404 (endpoint doesn't exist) vs actual error
      if (response.status === 404) {
        // Try alternative endpoint
        const altResponse = await fetch(
          `${apiUrl}/api/v1/workspaces/${workspaceId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(credentials.MATIC_API_KEY && {
                Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
              }),
            },
          }
        );

        if (altResponse.ok) {
          // API is reachable, assume email will work
          return { success: true };
        }
      }

      return {
        success: false,
        error: `API connection failed: ${response.status}`,
      };
    }

    const data = await response.json();
    if (data.is_connected === false) {
      return {
        success: false,
        error: "Gmail is not connected. Please connect Gmail in Matic workspace settings.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
