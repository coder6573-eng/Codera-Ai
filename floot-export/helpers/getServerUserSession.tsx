/**
 * Fail-closed auth placeholder for the optional internal agent endpoints.
 * Codera's public web-builder UI does not use these endpoints yet.
 * Replace with a real session verifier before enabling any internal routes.
 */
export async function getServerUserSession(_request: Request): Promise<{ user: { id: number; role: string } }> {
  throw new Error("Authentication is not configured for internal agent endpoints.");
}
