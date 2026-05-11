/**
 * spec0 commands — self-describing manifest of every command the CLI ships.
 *
 * Designed for AI agents and scripts that want to discover capabilities
 * without shelling out to `--help` and parsing prose. Walks the Commander
 * tree at runtime, so the manifest is always in lockstep with the binary.
 *
 * Typical agent workflow:
 *
 *   1. `spec0 commands --output=json` → enumerate every command, its flags,
 *      positional args, and description.
 *   2. Pick the command that matches the task (e.g. "publish a spec" →
 *      `publish`).
 *   3. Invoke it with `--output=json` for machine-readable results, and
 *      branch on exit codes (see the bundled `exitCodes` table).
 */

import { Command } from "commander";
import chalk from "chalk";
import { ExitCode, exit } from "../lib/exit-codes.js";
import { emit, resolveOutputContext, type OutputOptions } from "../lib/output/index.js";

interface CommandManifest {
  version: string;
  commands: CommandEntry[];
  exitCodes: Record<string, string>;
}

interface CommandEntry {
  name: string;
  description: string;
  usage: string;
  args: ArgEntry[];
  flags: FlagEntry[];
}

interface ArgEntry {
  name: string;
  required: boolean;
  description?: string;
}

interface FlagEntry {
  flags: string;
  description: string;
  defaultValue?: unknown;
}

const EXIT_CODES: Record<string, string> = {
  "0": "success",
  "1": "generic / unclassified failure",
  "2": "usage error (bad flags, missing args)",
  "3": "not authenticated (no token / token expired)",
  "4": "permission denied (403)",
  "5": "resource not found (404)",
  "6": "conflict (409 — e.g. name already taken)",
  "7": "validation failed (422 — e.g. spec below min score)",
  "8": "rate limited (429)",
  "9": "upstream server error (5xx)",
  "10": "network error (unreachable, timeout)",
};

export function registerCommandsCommand(program: Command) {
  program
    .command("commands")
    .description(
      "List every command in a machine-readable manifest. Designed for AI agents and scripts.",
    )
    .argument("[pattern]", "Filter commands by substring match on name (case-insensitive)")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action((pattern: string | undefined, opts: OutputOptions) => {
      const ctx = resolveOutputContext(opts);
      const manifest = buildManifest(program, pattern);
      emit(ctx, manifest, renderText);
      exit(ExitCode.SUCCESS);
    });
}

function buildManifest(program: Command, pattern?: string): CommandManifest {
  const needle = pattern?.toLowerCase();
  const all = walkCommands(program, "");
  const commands = needle ? all.filter((c) => c.name.toLowerCase().includes(needle)) : all;
  return {
    version: program.version() ?? "unknown",
    commands,
    exitCodes: EXIT_CODES,
  };
}

function walkCommands(cmd: Command, prefix: string): CommandEntry[] {
  const out: CommandEntry[] = [];
  for (const sub of cmd.commands) {
    // Skip commander's auto-generated `help` leaf — it's not a real operation.
    if (sub.name() === "help") continue;

    const name = prefix ? `${prefix} ${sub.name()}` : sub.name();

    // Only emit an entry when this node has an action (leaf command). Groups
    // like `spec0 api` or `spec0 mock` exist purely to host subcommands and
    // aren't themselves runnable.
    const hasAction = hasRegisteredAction(sub);
    if (hasAction) {
      out.push({
        name,
        description: sub.description() || "",
        usage: buildUsage(sub, name),
        args: extractArgs(sub),
        flags: extractFlags(sub),
      });
    }

    // Recurse into subcommand groups.
    if (sub.commands.length > 0) {
      out.push(...walkCommands(sub, name));
    }
  }
  return out;
}

// Commander doesn't expose "has action?" publicly; reach for the underlying
// field. Commands registered via `.action(...)` set this; noun-only groups
// (e.g. `spec0 api`) don't.
function hasRegisteredAction(cmd: Command): boolean {
  return typeof (cmd as unknown as { _actionHandler?: unknown })._actionHandler === "function";
}

function buildUsage(cmd: Command, name: string): string {
  const argSegments = cmd.registeredArguments
    .map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`))
    .join(" ");
  return `spec0 ${name}${argSegments ? ` ${argSegments}` : ""} [options]`;
}

function extractArgs(cmd: Command): ArgEntry[] {
  return cmd.registeredArguments.map((a) => ({
    name: a.name(),
    required: a.required,
    description: a.description || undefined,
  }));
}

function extractFlags(cmd: Command): FlagEntry[] {
  return cmd.options.map((o) => ({
    flags: o.flags,
    description: o.description,
    defaultValue: o.defaultValue,
  }));
}

function renderText(m: CommandManifest): string {
  const lines: string[] = [];
  lines.push(chalk.bold(`spec0 ${m.version} — command manifest`));
  lines.push("");
  lines.push(chalk.gray(`${m.commands.length} commands. For full detail, use --output=json.`));
  lines.push("");
  const nameWidth = Math.max(...m.commands.map((c) => c.name.length), 12);
  for (const c of m.commands) {
    const padded = c.name.padEnd(nameWidth);
    lines.push(`  ${chalk.cyan(padded)}  ${c.description}`);
  }
  lines.push("");
  lines.push(chalk.bold("Exit codes"));
  for (const [code, label] of Object.entries(m.exitCodes)) {
    lines.push(`  ${code.padStart(2)}  ${label}`);
  }
  return lines.join("\n");
}
