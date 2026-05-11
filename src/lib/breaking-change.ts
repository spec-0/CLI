/**
 * Breaking change detection — oasdiff wrapper (client-side fallback)
 * Server-side uses openapi-diff in Java
 */

export interface BreakingChange {
  path: string;
  method?: string;
  change: string;
  severity: "breaking" | "non-breaking";
}

export async function detectBreakingChanges(
  _oldSpecPath: string,
  _newSpecPath: string,
): Promise<BreakingChange[]> {
  // Client-side: would shell out to oasdiff or use npm oasdiff
  // For scaffold, return empty
  return [];
}
