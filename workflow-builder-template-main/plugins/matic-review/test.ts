export async function testMaticReview(
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
    // Test connection by fetching workspace info
    const response = await fetch(`${apiUrl}/api/v1/workspaces/${workspaceId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(credentials.MATIC_API_KEY && {
          Authorization: `Bearer ${credentials.MATIC_API_KEY}`,
        }),
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to connect to Matic: ${response.statusText}`,
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
