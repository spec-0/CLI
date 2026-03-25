/**
 * winspect team list | create | invite | members
 */

import { Command } from "commander";
import chalk from "chalk";

export function registerTeamCommands(program: Command) {
  const team = program.command("team").description("Team management");

  team.command("list").description("List teams").action(async () => {
    console.log(chalk.yellow("Team list not yet implemented."));
  });

  team
    .command("create <name>")
    .description("Create team")
    .action(async (name: string) => {
      console.log(chalk.yellow(`Team create ${name} not yet implemented.`));
    });

  team
    .command("invite <email>")
    .description("Invite user to team")
    .option("--team <name>", "Team name")
    .action(async (email: string, opts: { team?: string }) => {
      console.log(chalk.yellow("Team invite not yet implemented."));
    });

  team
    .command("members <name>")
    .description("List team members")
    .action(async (name: string) => {
      console.log(chalk.yellow(`Team members ${name} not yet implemented.`));
    });
}
