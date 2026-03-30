/**
 * Platform API HTTP client
 */

import got, { type Options } from "got";
import type { OrgConfig } from "./config.js";
import type { ResolvedOrgContext } from "./auth-context.js";

export interface ApiClientOptions {
  apiUrl?: string;
  apiKey?: string;
  orgId?: string;
}

function orgHeaders(orgId: string, extra?: Record<string, string>): Record<string, string> {
  return { "X-Org-Id": orgId, ...extra };
}

export function createApiClient(org: OrgConfig) {
  const baseUrl = org.apiUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${org.apiKey}`,
  };

  return {
    async get<T = unknown>(path: string, options?: Options): Promise<T> {
      const res = await got.get(`${baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        responseType: "json",
      });
      return res.body as T;
    },

    async post<T = unknown>(path: string, body?: unknown, options?: Options): Promise<T> {
      const res = await got.post(`${baseUrl}${path}`, {
        ...options,
        json: body,
        headers: { ...headers, ...options?.headers },
        responseType: "json",
      });
      return res.body as T;
    },

    async put<T = unknown>(path: string, body?: unknown, options?: Options): Promise<T> {
      const res = await got.put(`${baseUrl}${path}`, {
        ...options,
        json: body,
        headers: { ...headers, ...options?.headers },
        responseType: "json",
      });
      return res.body as T;
    },

    async delete<T = unknown>(path: string, options?: Options): Promise<T> {
      const res = await got.delete(`${baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        responseType: "json",
      });
      return res.body as T;
    },
  };
}

/** Org API key client (discovery, registry, CLI workspace). */
export function createOrgApiClient(ctx: ResolvedOrgContext) {
  const baseUrl = ctx.apiUrl;
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${ctx.apiKey}`,
    "X-Org-Id": ctx.orgId,
  };

  return {
    baseUrl,
    async getJson<T = unknown>(path: string, headers?: Record<string, string>): Promise<T> {
      const res = await got.get(`${baseUrl}${path}`, {
        headers: { ...baseHeaders, Accept: "application/json", ...headers },
        responseType: "json",
      });
      return res.body as T;
    },
    async getText(path: string, headers?: Record<string, string>): Promise<string> {
      const res = await got.get(`${baseUrl}${path}`, {
        headers: { ...baseHeaders, Accept: "application/yaml, application/json, text/plain, */*", ...headers },
      });
      return res.body;
    },
    async postJson<T = unknown>(
      path: string,
      body: unknown,
      headers?: Record<string, string>
    ): Promise<T> {
      const res = await got.post(`${baseUrl}${path}`, {
        json: body,
        headers: {
          ...baseHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers,
        },
        responseType: "json",
      });
      return res.body as T;
    },
    async deleteJson<T = unknown>(path: string, headers?: Record<string, string>): Promise<T> {
      const res = await got.delete(`${baseUrl}${path}`, {
        headers: { ...baseHeaders, Accept: "application/json", ...headers },
        responseType: "json",
      });
      return res.body as T;
    },
  };
}

export { orgHeaders };

export function is401(err: unknown): boolean {
  return (err as { response?: { statusCode?: number } })?.response?.statusCode === 401;
}

export function is402(err: unknown): boolean {
  return (err as { response?: { statusCode?: number } })?.response?.statusCode === 402;
}

/** Extract a human-readable error message from a backend error response. */
export function extractErrorMessage(err: unknown): string | null {
  const body = (err as { response?: { body?: unknown } })?.response?.body;
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    const msg = b["message"] ?? b["detail"] ?? b["error"];
    if (msg) return String(msg);
  }
  return null;
}
