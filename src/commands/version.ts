/**
 * spec0 version — CLI and runtime info
 */

import { Command } from "commander";
import { getVersionInfo } from "../lib/version.js";
import { emit, resolveOutputContext, type OutputOptions } from "../lib/output/index.js";
import { warnDeprecated } from "../lib/deprecation.js";

export function registerVersionCommand(program: Command) {
  program
    .command("version")
    .description("Print CLI version, Node.js version, and optional git ref (SPEC0_CLI_GIT_REF)")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .option("--json", "Deprecated. Use --output=json instead.")
    .action((opts: OutputOptions) => {
      if (opts.json) {
        warnDeprecated({
          what: "the --json flag on `spec0 version`",
          removeIn: "v1.0.0",
          alternative: "--output=json",
        });
      }

      const ctx = resolveOutputContext(opts);
      const info = getVersionInfo();

      emit(ctx, info, (data) => {
        const lines = [`${data.name} ${data.version}`, `node ${data.node}`];
        if (data.gitRef) lines.push(`ref ${data.gitRef}`);
        return lines.join("\n");
      });
    });
}
