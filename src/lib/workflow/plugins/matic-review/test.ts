export async function testMaticReview(
  _credentials: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  // Matic Review is an internal integration that uses the workspace context
  // No external credentials needed - it uses the current workspace and form
  // The actual connection test happens when actions are executed
  return { success: true };
}
