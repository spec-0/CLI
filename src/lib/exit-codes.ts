/**
 * Stable exit-code contract. These values are part of the CLI's public API —
 * once shipped, they MUST NOT be reused or repurposed. CI pipelines depend on
 * them.
 *
 * See README "Exit codes" section for the user-facing reference.
 */

export const ExitCode = {
  /** Operation succeeded. */
  SUCCESS: 0,
  /** Generic / unclassified failure. Avoid; pick a specific code instead. */
  GENERIC: 1,
  /** Bad invocation: missing required arg, conflicting flags, etc. */
  USAGE: 2,
  /** No credentials available, or token expired. Hint at SPEC0_TOKEN. */
  AUTH_MISSING: 3,
  /** Authenticated but lacking required permission (HTTP 403). */
  PERMISSION_DENIED: 4,
  /** Resource (API, mock, environment, …) does not exist (HTTP 404). */
  NOT_FOUND: 5,
  /** Conflict on create/update — e.g. name already taken (HTTP 409). */
  CONFLICT: 6,
  /** Validation failure — e.g. spec lint score below threshold (HTTP 422 or local). */
  VALIDATION: 7,
  /** Rate limit hit (HTTP 429). */
  RATE_LIMITED: 8,
  /** Server-side failure the user can't act on directly (HTTP 5xx). */
  SERVER_ERROR: 9,
  /** Network unreachable, timeout, DNS failure. */
  NETWORK_ERROR: 10,
} as const;

export type ExitCodeName = keyof typeof ExitCode;
export type ExitCodeValue = (typeof ExitCode)[ExitCodeName];

/**
 * Classifies an HTTP-style error into the corresponding exit code. Anything
 * unrecognised falls back to `GENERIC` so callers can chain this safely.
 */
export function exitCodeForHttpStatus(status: number | undefined): ExitCodeValue {
  if (status === undefined) return ExitCode.NETWORK_ERROR;
  if (status === 401) return ExitCode.AUTH_MISSING;
  if (status === 403) return ExitCode.PERMISSION_DENIED;
  if (status === 404) return ExitCode.NOT_FOUND;
  if (status === 409) return ExitCode.CONFLICT;
  if (status === 422) return ExitCode.VALIDATION;
  if (status === 429) return ExitCode.RATE_LIMITED;
  if (status >= 500 && status < 600) return ExitCode.SERVER_ERROR;
  return ExitCode.GENERIC;
}

/**
 * Single exit point. Logs `message` to stderr (if provided) before exiting.
 * Commands MUST go through this rather than calling `process.exit` directly so
 * that future logging / telemetry can hook one place.
 */
export function exit(code: ExitCodeValue, message?: string): never {
  if (message) {
    process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
  }
  process.exit(code);
}
