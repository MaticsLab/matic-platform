export async function testMaticEmail(
  _credentials: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  // Matic Email is an internal integration that uses the workspace context
  // No external credentials needed - it uses the connected Gmail account
  // The actual connection test happens when the email is sent
  return { success: true };
}
