#!/usr/bin/env node
/**
 * scripts/generate-docs.mjs — render docs/commands/*.md from the live capability manifest.
 *
 * Usage:
 *   npm run docs            # write docs/commands/
 *   npm run docs:check      # fail if the committed docs disagree with what we'd render
 *
 * Requires the CLI to be built first (dist/index.js). The generator shells out
 * to `node dist/index.js commands --output=json` so the manifest is produced
 * by the same code path agents and scripts hit at runtime — no parallel
 * source of truth.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const bin = resolve(root, "dist", "index.js");
const outDir = resolve(root, "docs", "commands");
const MODE = process.argv[2] ?? "write";

if (!existsSync(bin)) {
  console.error(`dist/index.js not found. Run 'npm run build' first.`);
  process.exit(1);
}

// ── Pull the manifest ────────────────────────────────────────────────────────

const res = spawnSync("node", [bin, "commands", "--output=json"], {
  encoding: "utf-8",
  cwd: root,
  env: { ...process.env, NO_COLOR: "1" },
});
if (res.status !== 0) {
  console.error(`spec0 commands failed (exit ${res.status}):\n${res.stderr}`);
  process.exit(1);
}
const manifest = JSON.parse(res.stdout);

// ── Render ───────────────────────────────────────────────────────────────────

/** name like "mock show" → filename "mock-show.md" */
function slugify(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function table(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const header = `| ${keys.join(" | ")} |`;
  const sep = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${keys.map((k) => String(r[k] ?? "")).join(" | ")} |`).join("\n");
  return [header, sep, body].join("\n");
}

function renderCommandPage(cmd) {
  const lines = [];
  lines.push(`# \`spec0 ${cmd.name}\``);
  lines.push("");
  lines.push(
    "> Auto-generated from the `spec0 commands --output=json` manifest. Do not edit by hand.",
  );
  lines.push("> Run `npm run docs` to regenerate after changing command flags.");
  lines.push("");
  if (cmd.description) {
    lines.push(cmd.description);
    lines.push("");
  }
  lines.push("## Usage");
  lines.push("");
  lines.push("```bash");
  lines.push(cmd.usage);
  lines.push("```");
  lines.push("");

  if (cmd.args?.length) {
    lines.push("## Arguments");
    lines.push("");
    lines.push(
      table(
        cmd.args.map((a) => ({
          name: `\`${a.name}\``,
          required: a.required ? "yes" : "no",
          description: a.description ?? "",
        })),
      ),
    );
    lines.push("");
  }

  if (cmd.flags?.length) {
    lines.push("## Flags");
    lines.push("");
    lines.push(
      table(
        cmd.flags.map((f) => ({
          flag: `\`${f.flags}\``,
          description: f.description ?? "",
          default: f.defaultValue !== undefined ? `\`${f.defaultValue}\`` : "",
        })),
      ),
    );
    lines.push("");
  }

  lines.push("## Exit codes");
  lines.push("");
  lines.push("See the [full exit-code table](../../README.md#exit-codes).");
  lines.push("");
  lines.push("## See also");
  lines.push("");
  lines.push("- [All commands](README.md)");
  lines.push("- [Agent guide](../guides/ai-agents.md)");
  lines.push("");
  return lines.join("\n");
}

function renderIndex(commands) {
  const lines = [];
  lines.push("# Command reference");
  lines.push("");
  lines.push(
    "> Auto-generated from the `spec0 commands --output=json` manifest. Do not edit by hand.",
  );
  lines.push("");
  lines.push(
    `\`spec0 ${manifest.version}\` exposes ${commands.length} commands. Each page describes the flags and arguments for a single command.`,
  );
  lines.push("");
  lines.push("| Command | Description |");
  lines.push("| --- | --- |");
  for (const c of commands) {
    lines.push(`| [\`spec0 ${c.name}\`](${slugify(c.name)}.md) | ${c.description} |`);
  }
  lines.push("");
  lines.push(
    "Regenerate with `npm run docs`. CI fails if the committed files drift (`npm run docs:check`).",
  );
  lines.push("");
  return lines.join("\n");
}

// ── Write out ────────────────────────────────────────────────────────────────

const files = new Map();
files.set("README.md", renderIndex(manifest.commands));
for (const cmd of manifest.commands) {
  files.set(`${slugify(cmd.name)}.md`, renderCommandPage(cmd));
}

if (MODE === "check") {
  // Compare generated vs on-disk; exit non-zero on any drift.
  let drift = 0;
  const onDisk = existsSync(outDir) ? new Set(readdirSync(outDir)) : new Set();

  for (const [name, content] of files) {
    const path = resolve(outDir, name);
    const current = existsSync(path) ? readFileSync(path, "utf-8") : "";
    if (current !== content) {
      console.error(`drift: ${name}`);
      drift++;
    }
    onDisk.delete(name);
  }
  for (const stray of onDisk) {
    console.error(`stray file (would be removed): ${stray}`);
    drift++;
  }
  if (drift > 0) {
    console.error(`\n${drift} doc file(s) out of sync. Run 'npm run docs' and commit.`);
    process.exit(1);
  }
  console.log(`docs/commands/: ${files.size} files in sync.`);
  process.exit(0);
}

// MODE === "write": refresh the directory.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [name, content] of files) {
  writeFileSync(resolve(outDir, name), content, "utf-8");
}
console.log(`Wrote ${files.size} files to docs/commands/.`);
