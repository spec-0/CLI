#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPushCommand } from "./commands/push.js";
import { registerMockCommands } from "./commands/mock.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerPullCommand } from "./commands/pull.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerLogCommand } from "./commands/log.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerMcpCommands } from "./commands/mcp.js";
import { registerVersionCommand } from "./commands/version.js";
import { getCliVersion } from "./lib/version.js";
import { notifyUpdateIfAvailable } from "./lib/update-check.js";

const program = new Command();

program
  .name("spec0")
  .description("Manage and publish OpenAPI specs, run mock servers, and lint — powered by Spec0")
  .version(getCliVersion(), "-V, --version", "Print CLI version")
  .helpOption("-h, --help", "Show help");

registerVersionCommand(program);
registerAuthCommands(program);
registerInitCommand(program);
registerPushCommand(program);
registerPublishCommand(program);
registerMockCommands(program);
registerLintCommand(program);
registerPullCommand(program);
registerSearchCommand(program);
registerDiffCommand(program);
registerLogCommand(program);
registerStatusCommand(program);
registerMcpCommands(program);

notifyUpdateIfAvailable(getCliVersion());

program.parse();
