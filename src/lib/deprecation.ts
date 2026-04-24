/**
 * Deprecation warnings. Always print to stderr with a clear removal-version
 * header so users have time to migrate.
 *
 * Set SPEC0_SUPPRESS_DEPRECATION=1 to silence in CI logs once the migration
 * is queued.
 */

import chalk from "chalk";

export interface DeprecationNotice {
  /** What the user did, e.g. "the --json flag" or "the SPEC0_LEGACY env var". */
  what: string;
  /** Version when this stops working. e.g. "v1.0.0". */
  removeIn: string;
  /** What the user should do instead. e.g. "use --output=json". */
  alternative: string;
}

const seen = new Set<string>();

export function warnDeprecated(notice: DeprecationNotice): void {
  if (process.env.SPEC0_SUPPRESS_DEPRECATION) return;

  const key = `${notice.what}|${notice.removeIn}`;
  if (seen.has(key)) return; // print once per process
  seen.add(key);

  const useColour = Boolean(process.stderr.isTTY);
  const tag = useColour ? chalk.yellow("⚠ deprecated:") : "DEPRECATED:";
  const msg = `${tag} ${notice.what} will be removed in ${notice.removeIn}. Use ${notice.alternative}.`;
  process.stderr.write(msg + "\n");
}
