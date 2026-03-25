/**
 * winspect auth login | logout | status | token | switch
 */

import { Command } from "commander";
import chalk from "chalk";
import { createServer } from "http";
import { randomBytes } from "crypto";
import open from "open";
import {
  getConfig,
  getDefaultOrgId,
  getOrgConfig,
  setOrgConfig,
  setDefaultOrg,
  clearConfig,
} from "../lib/config.js";
import { resolvedPlatformAppUrl, resolvedPlatformApiUrl } from "../lib/platform-defaults.js";

function getAppUrl(): string {
  return resolvedPlatformAppUrl();
}

function getApiUrl(): string {
  return resolvedPlatformApiUrl();
}

export function registerAuthCommands(program: Command) {
  const auth = program.command("auth").description("Authentication and org management");

  auth
    .command("login")
    .description("Browser-based login, stores API key in ~/.winspect/config.json")
    .option("--app-url <url>", "Web app origin for /cli-auth (default: PLATFORM_APP_URL or local Next.js)")
    .option(
      "--api-url <url>",
      "Backend API base for later commands, e.g. http://localhost:8080/api-management (default: PLATFORM_API_URL)"
    )
    .action(async (opts: { appUrl?: string; apiUrl?: string }) => {
      const appUrl = opts.appUrl ?? getAppUrl();
      const state = randomBytes(16).toString("hex");
      const port = 38473 + (Math.floor(Math.random() * 1000) % 1000);
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      const authUrl = new URL("/cli-auth", appUrl);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("redirect_uri", redirectUri);

      console.log(chalk.blue("Opening browser for authentication..."));
      console.log(chalk.gray(`If the browser doesn't open, visit: ${authUrl.toString()}`));

      const result = await new Promise<{ token: string; orgId: string; orgName: string } | { error: string }>(
        (resolve) => {
          let resolved = false;
          const doResolve = (r: { token: string; orgId: string; orgName: string } | { error: string }) => {
            if (resolved) return;
            resolved = true;
            resolve(r);
          };

          const server = createServer((req, res) => {
            const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
            if (url.pathname === "/callback") {
              const token = url.searchParams.get("token");
              const orgId = url.searchParams.get("org");
              const orgName = url.searchParams.get("org_name") ?? "default";
              if (token && orgId) {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(
                  `<!DOCTYPE html><html><head><title>Winspect CLI</title></head><body><p style="font-family:sans-serif;padding:2rem;">Authorization complete. You can close this window and return to the terminal.</p></body></html>`
                );
                doResolve({ token, orgId, orgName });
              } else {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Missing token or org. Please try again.");
                doResolve({ error: "Missing token or org" });
              }
            } else {
              res.writeHead(404);
              res.end();
            }
            server.close();
          });

          server.listen(port, "127.0.0.1", () => {
            open(authUrl.toString()).catch(() => {});
          });

          server.on("error", (err) => {
            doResolve({ error: err.message });
          });

          const timeout = setTimeout(() => {
            if (!resolved && server.listening) {
              server.close();
              doResolve({
                error: "Login timed out. Run 'winspect auth login' again or set PLATFORM_API_TOKEN manually.",
              });
            }
          }, 120000);
          server.on("close", () => clearTimeout(timeout));
        }
      );

      if ("error" in result) {
        console.error(chalk.red(result.error));
        process.exit(1);
      }

      const keyName = `CLI — ${new Date().toISOString().slice(0, 10)}`;
      const apiUrlForStore = opts.apiUrl?.trim() ? opts.apiUrl.trim().replace(/\/$/, "") : getApiUrl();
      setOrgConfig(result.orgId, {
        apiKey: result.token,
        name: result.orgName,
        apiUrl: apiUrlForStore,
        keyName,
      });
      const config = getConfig();
      if (!config.defaultOrg) {
        setDefaultOrg(result.orgId);
      }
      console.log(chalk.green("Logged in successfully."));
      console.log(`  Org: ${result.orgName}`);
      console.log(`  API: ${apiUrlForStore}`);
      console.log(`  Key: ${keyName}`);
    });

  auth
    .command("logout")
    .description("Deactivate key on server and clear local config")
    .action(async () => {
      clearConfig();
      console.log(chalk.green("Logged out. Config cleared."));
    });

  auth
    .command("status")
    .description("Print current user, org, plan, key name")
    .action(async () => {
      const defaultOrgId = getDefaultOrgId();
      if (!defaultOrgId) {
        console.log(chalk.yellow("Not logged in. Run 'winspect auth login' or set PLATFORM_API_TOKEN."));
        return;
      }
      const org = getOrgConfig(defaultOrgId);
      if (!org) {
        console.log(chalk.yellow("Org config missing. Run 'winspect auth login'."));
        return;
      }
      console.log(`Org: ${org.name}`);
      console.log(`API URL: ${org.apiUrl}`);
      console.log(`Key: ${org.keyName ?? "(unnamed)"}`);
    });

  auth
    .command("token")
    .description("Print token (for scripting: winspect auth token | pbcopy)")
    .action(async () => {
      const defaultOrgId = getDefaultOrgId();
      if (!defaultOrgId) process.exit(1);
      const org = getOrgConfig(defaultOrgId);
      if (!org) process.exit(1);
      console.log(org.apiKey);
    });

  auth
    .command("switch <org-name>")
    .description("Switch default org")
    .action(async (orgName: string) => {
      const config = getConfig();
      const entry = Object.entries(config.orgs).find(([, o]) => o.name === orgName);
      if (!entry) {
        console.error(chalk.red(`Org '${orgName}' not found.`));
        process.exit(1);
      }
      setDefaultOrg(entry[0]);
      console.log(chalk.green(`Switched to org: ${orgName}`));
    });
}
