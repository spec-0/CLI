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
