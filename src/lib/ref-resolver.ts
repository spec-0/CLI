/**
 * Single source of truth for parsing `<ref>` arguments.
 *
 * Accepts:
 *   - `<org>/<api>[@<tag>]`        — full registry ref
 *   - `<api>[@<tag>]`              — uses caller-supplied default org slug
 *   - `<uuid>`                     — API id (no org/api lookup needed)
 *
 * For commands that need an apiId from a name, call `resolveApiId(client, ref)`
 * which hits `/apis/summary` and caches per-process.
 */

import { parseRegistryRef } from "./registry-ref.js";

/** Minimal structural type — avoids dragging the full client surface in. */
interface ApiSummaryClient {
  getJson(path: string): Promise<unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedRef =
  | { kind: "uuid"; apiId: string; tag?: undefined }
  | { kind: "name"; org: string | undefined; api: string; tag?: string };

export interface ResolveOptions {
  /** Fallback org slug used when the ref omits one (e.g. plain `api-name`). */
  defaultOrg?: string;
}

export function resolveRef(ref: string, opts: ResolveOptions = {}): ResolvedRef {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error("Empty ref. Expected <org>/<api>[@<tag>] or a UUID.");

  if (UUID_RE.test(trimmed)) {
    return { kind: "uuid", apiId: trimmed };
  }

  if (trimmed.includes("/")) {
    const p = parseRegistryRef(trimmed);
    return { kind: "name", org: p.org, api: p.api, tag: p.tag };
  }

  // No slash + not a UUID → treat as `<api>[@<tag>]` against defaultOrg.
  let api = trimmed;
  let tag: string | undefined;
  const at = trimmed.lastIndexOf("@");
  if (at !== -1) {
    tag = trimmed.slice(at + 1);
    api = trimmed.slice(0, at);
  }
  return { kind: "name", org: opts.defaultOrg, api, tag };
}

interface SummaryRow {
  apiId?: string;
  apiName?: string;
}

const idCache = new Map<string, string>(); // key = `${org}/${api}` → apiId

/**
 * Resolve an apiId from a ref. UUIDs pass through; names hit `/apis/summary`.
 * Cached per-process so repeated calls in one command are free.
 */
export async function resolveApiId(client: ApiSummaryClient, ref: ResolvedRef): Promise<string> {
  if (ref.kind === "uuid") return ref.apiId;

  const key = `${ref.org ?? ""}/${ref.api}`;
  const cached = idCache.get(key);
  if (cached) return cached;

  const rows = (await client.getJson("/apis/summary")) as SummaryRow[];
  const wantedName = ref.api.toLowerCase();
  const hit = rows.find((r) => (r.apiName ?? "").toLowerCase() === wantedName);
  if (!hit?.apiId) {
    throw new Error(
      `No API named '${ref.api}' found${ref.org ? ` in '${ref.org}'` : ""}. Run 'spec0 api list' to see what exists.`,
    );
  }
  idCache.set(key, hit.apiId);
  return hit.apiId;
}
