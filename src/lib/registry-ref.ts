/**
 * Parse registry refs like acme/order-api or acme/order-api@v1.2.0
 */

export interface ParsedRegistryRef {
  org: string;
  api: string;
  tag?: string;
}

export function parseRegistryRef(ref: string): ParsedRegistryRef {
  let rest = ref.trim();
  let tag: string | undefined;
  const at = rest.lastIndexOf("@");
  if (at !== -1) {
    tag = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const slash = rest.indexOf("/");
  if (slash === -1) {
    throw new Error("Expected <org-slug>/<api-name>[@version]");
  }
  return { org: rest.slice(0, slash), api: rest.slice(slash + 1), tag };
}
