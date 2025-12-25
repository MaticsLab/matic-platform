export async function testV0(credentials: Record<string, string>) {
  try {
    const apiKey = credentials.V0_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: "API key is required",
      };
    }

    // Test the API key by making a request to v0 API
    // Note: v0-sdk may not be installed, so we use fetch directly
    const response = await fetch("https://api.v0.dev/v1/user", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
