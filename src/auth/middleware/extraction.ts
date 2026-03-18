export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) {
    return null;
  }

  // Check for Bearer scheme (case-insensitive)
  const parts = authHeader.split(" ");
  const scheme = parts[0];
  const tokenPart = parts[1];
  if (parts.length !== 2 || scheme?.toLowerCase() !== "bearer") {
    return null;
  }

  if (tokenPart === undefined) {
    return null;
  }

  const token = tokenPart.trim();
  return token.length > 0 ? token : null;
}
