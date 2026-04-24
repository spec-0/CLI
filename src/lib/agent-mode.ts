/**
 * SPEC0_MODE=agent — single switch that flips every agent-friendly default.
 *
 * When set, the CLI behaves deterministically for machine callers:
 *   - default output format is JSON (no need to pass --output=json on every cmd)
 *   - spinners suppressed (no ANSI control codes in the output stream)
 *   - colour suppressed (NO_COLOR semantics)
 *   - update-check noise on stderr suppressed
 *   - TTY heuristics treated as non-interactive
 *
 * A command may still override the format by passing an explicit --output flag;
 * agent mode only changes defaults, it doesn't block choice.
 *
 * Called once during CLI bootstrap (see src/index.ts) so env-var side-effects
 * — in particular NO_COLOR — land before any module reads them.
 */

/** True when the caller has explicitly opted in via SPEC0_MODE=agent. */
export function isAgentMode(): boolean {
  return (process.env.SPEC0_MODE ?? "").toLowerCase() === "agent";
}

/**
 * Apply the environment-level side-effects. Must run before `chalk` /
 * `ora` / anything else that reads NO_COLOR or checks isTTY at import time.
 * Idempotent — only sets vars that are currently unset.
 */
export function applyAgentModeEnv(): void {
  if (!isAgentMode()) return;
  if (!process.env.NO_COLOR) process.env.NO_COLOR = "1";
  // FORCE_COLOR=0 is a belt-and-braces hint for libraries that honour it
  // instead of NO_COLOR.
  if (!process.env.FORCE_COLOR) process.env.FORCE_COLOR = "0";
}
