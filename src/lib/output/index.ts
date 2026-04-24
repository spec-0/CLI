/**
 * Unified output for every command. One way to do a thing — see ROADMAP.md.
 *
 * Usage:
 *
 *   const ctx = resolveOutputContext(opts);
 *   emit(ctx, data, (d) => formatTextLines(d));
 *
 * - Progress / log messages always go to stderr (use `progress(ctx, msg)`).
 * - Final result always goes to stdout via `emit()` — exactly one document.
 * - Default format is `text`, auto-coloured when stdout is a TTY.
 */

import { stringify as yamlStringify } from "yaml";
import { ExitCode, exitCodeName, type ExitCodeValue } from "../exit-codes.js";
import { isAgentMode } from "../agent-mode.js";

export type OutputFormat = "text" | "json" | "yaml";

export interface OutputContext {
  format: OutputFormat;
  /** Whether the stdout we'll print to is a real terminal (colour OK). */
  isTTY: boolean;
  /** Suppress non-essential progress messages on stderr. */
  quiet: boolean;
  /** Print extra diagnostics on stderr (e.g. HTTP traces). */
  verbose: boolean;
}

export interface OutputOptions {
  output?: string;
  format?: string; // legacy alias kept for back-compat
  json?: boolean; // legacy boolean shortcut
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Build an OutputContext from CLI options. Accepts the new `--output` flag
 * plus the legacy `--json` and `--format` flags for one-minor backwards
 * compatibility (callers that hand-roll deprecation warnings should still do
 * so explicitly via `lib/deprecation.ts`).
 */
export function resolveOutputContext(opts: OutputOptions = {}): OutputContext {
  const fromOutput = normaliseFormat(opts.output);
  const fromFormat = normaliseFormat(opts.format);
  const fromJson = opts.json ? "json" : undefined;
  // Agent mode: default format is json unless the caller passed an explicit
  // --output / --format / --json flag.
  const agent = isAgentMode();
  const fallback: OutputFormat = agent ? "json" : "text";
  const format = (fromOutput ?? fromFormat ?? fromJson ?? fallback) as OutputFormat;

  return {
    format,
    // Agent mode suppresses TTY heuristics (colour, progress bars) regardless
    // of the actual stdout.
    isTTY: agent ? false : Boolean(process.stdout.isTTY),
    quiet: Boolean(opts.quiet) || agent,
    verbose: Boolean(opts.verbose),
  };
}

function normaliseFormat(raw: string | undefined): OutputFormat | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().trim();
  if (v === "text" || v === "json" || v === "yaml") return v;
  // Legacy --format=github survives until we add native annotations.
  if (v === "github") return "text";
  return undefined;
}

/**
 * Print the final result. Exactly one call per command.
 * `textRenderer` receives the data and returns a single string for `text` mode.
 */
export function emit<T>(ctx: OutputContext, data: T, textRenderer: (data: T) => string): void {
  if (ctx.format === "json") {
    // Pretty when interactive so humans can read; compact when piped so
    // downstream tools don't get extra whitespace they didn't ask for.
    process.stdout.write(JSON.stringify(data, null, ctx.isTTY ? 2 : 0) + "\n");
    return;
  }
  if (ctx.format === "yaml") {
    process.stdout.write(yamlStringify(data));
    return;
  }
  process.stdout.write(textRenderer(data) + "\n");
}

export interface FailOptions {
  /** Short actionable hint ("Set SPEC0_TOKEN", "Run 'spec0 auth login'"). */
  hint?: string;
  /** Additional context the caller wants surfaced in the structured payload. */
  details?: Record<string, unknown>;
}

/**
 * Single structured failure point. Companions `emit()` — same output contract:
 *
 *   - In text mode: writes `message` (and hint, if given) to stderr. Matches
 *     what the bare `exit(code, message)` helper produces, so human UX is
 *     unchanged.
 *   - In json / yaml mode: emits `{error: {code, message, hint?, details?}}`
 *     on **stdout** so agents see one machine-readable document per invocation
 *     regardless of success vs failure. The `code` field uses the symbolic
 *     name ("AUTH_MISSING", "NOT_FOUND", …) from exit-codes.ts.
 *
 * Always exits with the numeric exit code — callers can rely on `never`.
 */
export function fail(
  ctx: OutputContext,
  code: ExitCodeValue,
  message: string,
  opts: FailOptions = {},
): never {
  if (ctx.format === "json" || ctx.format === "yaml") {
    const payload = {
      error: {
        code: exitCodeName(code),
        message,
        ...(opts.hint ? { hint: opts.hint } : {}),
        ...(opts.details ? { details: opts.details } : {}),
      },
    };
    if (ctx.format === "json") {
      process.stdout.write(JSON.stringify(payload, null, ctx.isTTY ? 2 : 0) + "\n");
    } else {
      process.stdout.write(yamlStringify(payload));
    }
  } else {
    const tail = opts.hint ? `${message}\n  ${opts.hint}` : message;
    process.stderr.write(tail.endsWith("\n") ? tail : `${tail}\n`);
  }
  process.exit(code);
}

/** Guard against accidental use of GENERIC in fail(); callers should pick a specific code. */
export function failGeneric(ctx: OutputContext, message: string, opts?: FailOptions): never {
  return fail(ctx, ExitCode.GENERIC, message, opts);
}

/** Progress / status — only printed when not `--quiet`. Always to stderr. */
export function progress(ctx: OutputContext, message: string): void {
  if (ctx.quiet) return;
  process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
}

/** Verbose-only diagnostic. */
export function debug(ctx: OutputContext, message: string): void {
  if (!ctx.verbose) return;
  process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
}
