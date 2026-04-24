/**
 * spec0 pull <org>/<name> — download spec from registry
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "fs";
import { createOrgApiClient, is401 } from "../lib/api-client.js";
import { requireOrgContext } from "../lib/auth-context.js";
import { resolveRef } from "../lib/ref-resolver.js";
import { ExitCode, exit } from "../lib/exit-codes.js";

export function registerPullCommand(program: Command) {
  program
    .command("pull <ref>")
    .description(
      "Download spec from registry (e.g. acme/order-service or acme/order-service@v1.2.0)",
    )
    .option("-o, --output <file>", "Write to file instead of stdout")
    .option("--public", "Reserved for public registry (same endpoint when API is public)")
    .option("--org <uuid>", "Auth org id (defaults to logged-in org)")
    .action(async (ref: string, opts: { output?: string; public?: boolean; org?: string }) => {
      const parsed = resolveRefForPull(ref);
      let ctx;
      try {
        ctx = requireOrgContext(opts.org);
      } catch (e) {
        exit(ExitCode.AUTH_MISSING, (e as Error).message);
      }

      const client = createOrgApiClient(ctx);
      const path = parsed.tag
        ? `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}/versions/${encodeURIComponent(parsed.tag)}`
        : `/registry/${encodeURIComponent(parsed.org)}/${encodeURIComponent(parsed.api)}?format=yaml`;

      try {
        const yaml = await client.getText(path);
        if (opts.output) {
          writeFileSync(opts.output, yaml, "utf-8");
          console.log(chalk.green(`Wrote ${opts.output}`));
        } else {
          process.stdout.write(yaml);
        }
      } catch (err) {
        if (is401(err)) {
          exit(ExitCode.AUTH_MISSING, "Token invalid or expired. Run 'spec0 auth login'.");
        }
        exit(ExitCode.GENERIC, `Pull failed: ${(err as Error).message}`);
      }
    });
}

/** Pull only accepts <org>/<api>[@<tag>]; UUIDs and bare names aren't useful. */
function resolveRefForPull(ref: string): { org: string; api: string; tag?: string } {
  let parsed;
  try {
    parsed = resolveRef(ref);
  } catch (e) {
    exit(ExitCode.USAGE, (e as Error).message);
  }
  if (parsed.kind !== "name" || !parsed.org) {
    exit(
      ExitCode.USAGE,
      `Pull requires '<org>/<api>[@<tag>]'. Got '${ref}'. UUIDs aren't supported by the registry endpoint.`,
    );
  }
  return { org: parsed.org, api: parsed.api, tag: parsed.tag };
}
