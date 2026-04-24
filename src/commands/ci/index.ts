import { Command } from "commander";
import { registerCiGenerateCommand } from "./generate.js";

export function registerCiCommands(program: Command) {
  const ci = program.command("ci").description("Generate CI configuration for CI/CD pipelines.");
  registerCiGenerateCommand(ci);
}
