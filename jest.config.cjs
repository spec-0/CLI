const fs = require("fs");
const path = require("path");

/** Before any module loads `conf`, pin HOME so writes stay under the repo (sandbox/CI). */
const jestHome = path.join(__dirname, "test", ".jest-home");
process.env.HOME = jestHome;
if (process.platform === "darwin") {
  fs.mkdirSync(path.join(jestHome, "Library", "Preferences"), { recursive: true });
} else if (process.platform === "win32") {
  fs.mkdirSync(path.join(jestHome, "AppData", "Roaming"), { recursive: true });
} else {
  fs.mkdirSync(path.join(jestHome, ".config"), { recursive: true });
}

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  // Default `npm test` is offline-only. Integration tests live under
  // `test/integration/` and hit live staging — they're opted in via
  // `npm run test:integration`, which overrides this with --testPathPattern.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/test/integration/"],
  // Serialise across test files. config.test.ts and auth-context.test.ts both
  // talk to the same `conf`-backed JSON file under $HOME; with parallel Jest
  // workers on CI they race and fail intermittently. Suite is tiny (~1 s), so
  // the parallelism saving is negligible and determinism wins.
  maxWorkers: 1,
  moduleFileExtensions: ["ts", "js"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
          types: ["jest", "node"],
          isolatedModules: true,
        },
      },
    ],
  },
};
