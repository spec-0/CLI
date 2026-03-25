import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getCliVersion, getVersionInfo, readPackageVersion } from "../src/lib/version.js";

/** Jest runs with cwd = project root */
const rootDir = process.cwd();

describe("version", () => {
  it("getCliVersion matches package.json", () => {
    const pkgPath = join(rootDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(getCliVersion()).toBe(pkg.version);
    expect(readPackageVersion().version).toBe(pkg.version);
  });

  it("getVersionInfo includes node and optional git ref", () => {
    const prev = process.env.WINSPECT_CLI_GIT_REF;
    delete process.env.WINSPECT_CLI_GIT_REF;
    const plain = getVersionInfo();
    expect(plain.node).toBe(process.version);
    expect(plain.gitRef).toBeUndefined();

    process.env.WINSPECT_CLI_GIT_REF = "feature/x";
    const withRef = getVersionInfo();
    expect(withRef.gitRef).toBe("feature/x");

    if (prev !== undefined) process.env.WINSPECT_CLI_GIT_REF = prev;
    else delete process.env.WINSPECT_CLI_GIT_REF;
  });

  it("dist CLI prints version (requires build)", () => {
    const out = execSync("node dist/index.js version", {
      cwd: rootDir,
      encoding: "utf8",
      env: { ...process.env, WINSPECT_CLI_GIT_REF: "" },
    });
    expect(out).toMatch(/@winspect\/cli/);
    expect(out).toMatch(/\d+\.\d+\.\d+/);
  });
});
