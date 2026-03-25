/**
 * winspect publish — placeholder for a future publish workflow (registry promotion, etc.)
 */

import { Command } from "commander";
import chalk from "chalk";

export function registerPublishCommand(program: Command) {
  program
    .command("publish")
    .description("Publish workflow (not implemented yet)")
    .action(() => {
      console.error(
        chalk.yellow(
          "winspect publish is not implemented yet. Use winspect register to upload or update your OpenAPI spec."
        )
      );
    });
}
