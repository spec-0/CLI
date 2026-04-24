/**
 * spec0 api … — API management subcommands.
 */

import { Command } from "commander";
import { registerApiListCommand } from "./list.js";
import { registerApiShowCommand } from "./show.js";

export function registerApiCommands(program: Command) {
  const api = program.command("api").description("Manage APIs in your organisation");
  registerApiListCommand(api);
  registerApiShowCommand(api);
}
