/**
 * spec0 version — CLI and runtime info
 */

import { Command } from "commander";
import { getVersionInfo } from "../lib/version.js";

export function registerVersionCommand(program: Command) {
  program
    .command("version")
    .description("Print CLI version, Node.js version, and optional git ref (SPEC0_CLI_GIT_REF)")
    .option("--json", "Print machine-readable JSON")
    .action((opts: { json?: boolean }) => {
      const info = getVersionInfo();
      if (opts.json) {
        console.log(JSON.stringify(info, null, 0));
        return;
      }
      console.log(`${info.name} ${info.version}`);
      console.log(`node ${info.node}`);
      if (info.gitRef) {
        console.log(`ref ${info.gitRef}`);
      }
    });
}
