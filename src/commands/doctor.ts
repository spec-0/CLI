/**
 * spec0 doctor — print which config sources are in effect.
 *
 * Useful when an `auth missing` or `wrong URL` error fires and the user
 * wants to know "which env var or config file is the CLI actually reading?".
 *
 * Exits 0 when token + orgId resolve, otherwise the corresponding ExitCode.
 */

import { Command } from "commander";
import chalk from "chalk";
import { ExitCode, exit } from "../lib/exit-codes.js";
import { emit, resolveOutputContext, type OutputOptions } from "../lib/output/index.js";
import { buildDoctorReport, describeSource, type DoctorReport } from "../lib/doctor.js";

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description("Diagnose CLI configuration: where each setting is being read from.")
    .option("--output <format>", "Output format: text, json, or yaml (default: text)")
    .action((opts: OutputOptions) => {
      const ctx = resolveOutputContext(opts);
      const report = buildDoctorReport();

      emit(ctx, report, renderDoctorText);

      if (!report.ok) {
        // No message here — emit() already printed the diagnostic.
        process.exit(ExitCode.AUTH_MISSING);
      }
      exit(ExitCode.SUCCESS);
    });
}

function renderDoctorText(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold("spec0 configuration"));
  lines.push("");

  const colWidth = Math.max(...report.settings.map((s) => s.name.length));
  for (const s of report.settings) {
    const name = s.name.padEnd(colWidth);
    const src = describeSource(s.source);
    const colour = s.source.kind === "missing" ? chalk.red : chalk.gray;
    // describeSource for "missing" returns "(not set)" already; everything else is bare text.
    const srcDisplay = s.source.kind === "missing" ? src : `(${src})`;
    lines.push(`  ${name}  ${s.value}  ${colour(srcDisplay)}`);
  }

  lines.push("");
  lines.push(`  config file:  ${report.configPath}`);
  lines.push("");
  if (report.ok) {
    lines.push(chalk.green("✓ ready to talk to the platform"));
  } else {
    lines.push(chalk.red("✗ missing required settings — see above"));
    lines.push(
      chalk.gray(
        "  Set SPEC0_TOKEN + SPEC0_ORG_ID for non-interactive use, or run 'spec0 auth login'.",
      ),
    );
  }
  return lines.join("\n");
}
