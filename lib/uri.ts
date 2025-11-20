export function getDbUsername(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.username || null;
  } catch {
    return null;
  }
}
