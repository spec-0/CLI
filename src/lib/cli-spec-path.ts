/**
 * Resolve OpenAPI spec path from: subcommand --spec-file > global spec0 --spec-file > positional.
 */

import chalk from "chalk";
import { resolve } from "path";
import type { Command } from "commander";

export function resolveCliSpecPathFromFlags(
  command: Command,
  cwd: string,
  subcommandSpecFile: string | undefined,
  positional: string | undefined
): string | null {
  const fromSub = subcommandSpecFile?.trim();
  const root = command.parent?.opts() as { specFile?: string } | undefined;
  const fromRoot = root?.specFile?.trim();
  const fromPos = positional?.trim();

  const ordered: string[] = [];
  if (fromSub) {
    ordered.push(fromSub);
  }
  if (fromRoot) {
    ordered.push(fromRoot);
  }
  if (fromPos) {
    ordered.push(fromPos);
  }
  if (ordered.length === 0) {
    return null;
  }

  const resolvedAbs = ordered.map((p) => resolve(cwd, p));
  const firstAbs = resolvedAbs[0]!;
  for (let i = 1; i < resolvedAbs.length; i++) {
    if (resolvedAbs[i] !== firstAbs) {
      console.error(
        chalk.red(
          "Conflicting spec paths: use only one of --spec-file, spec0 --spec-file, or the positional [spec-file], and ensure they refer to the same file."
        )
      );
      process.exit(1);
    }
  }
  return ordered[0]!;
}
