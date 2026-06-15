/**
 * Opt-in HTTP request tracing for `--verbose`.
 *
 * The CLI talks to the platform over two transports: raw `got` (see
 * `api-client.ts`) and the generated `@spec0/sdk-public-platform`, which issues
 * calls through the global `fetch`. Neither prints anything by default, so a
 * failing command could not show *which URL* it hit — the exact gap that made a
 * misconfigured API base impossible to diagnose.
 *
 * When tracing is enabled we:
 *   - let `got`'s hooks call `traceRequest` / `traceResponse`, and
 *   - wrap the global `fetch` once so every SDK call is traced too.
 *
 * All trace output goes to **stderr** so stdout stays a clean single document
 * for `--output json|yaml` consumers.
 */

import chalk from "chalk";

let enabled = false;
let fetchPatched = false;

/** Enable/disable tracing. Installs the global `fetch` wrapper on first enable. */
export function setHttpTrace(on: boolean): void {
  enabled = on;
  if (on && !fetchPatched) patchFetch();
}

export function httpTraceEnabled(): boolean {
  return enabled;
}

function line(text: string): void {
  process.stderr.write(chalk.gray(text.endsWith("\n") ? text : `${text}\n`));
}

export function traceRequest(method: string, url: string): void {
  if (enabled) line(`→ ${method} ${url}`);
}

export function traceResponse(status: number, url: string): void {
  if (enabled) line(`← ${status} ${url}`);
}

export function traceError(method: string, url: string, message: string): void {
  if (enabled) line(`✗ ${method} ${url} — ${message}`);
}

function patchFetch(): void {
  const original = globalThis.fetch;
  if (typeof original !== "function") return;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const method =
      init?.method ??
      (typeof input === "object" && input !== null && "method" in input
        ? (input as Request).method
        : "GET");
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    traceRequest(method, url);
    try {
      const res = await original(input, init);
      traceResponse(res.status, url);
      return res;
    } catch (err) {
      traceError(method, url, (err as Error).message);
      throw err;
    }
  }) as typeof fetch;
  fetchPatched = true;
}
