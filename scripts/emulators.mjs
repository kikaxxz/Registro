import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
const environment = { ...process.env };
const pathKey =
  Object.keys(environment).find((key) => key.toLowerCase() === "path") ??
  "PATH";
const javaName = process.platform === "win32" ? "java.exe" : "java";
const candidates = [process.env.JAVA_HOME, undefined];
const localRuntime =
  process.env.LOCALAPPDATA &&
  path.join(process.env.LOCALAPPDATA, "RegistroTools");
if (localRuntime && existsSync(localRuntime))
  candidates.push(
    ...readdirSync(localRuntime, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"))
      .map((entry) => path.join(localRuntime, entry.name)),
  );
let javaFound = false;
for (const directory of candidates) {
  const command = directory ? path.join(directory, "bin", javaName) : javaName;
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const version = /version "(\d+)/.exec(
    `${result.stderr ?? ""}${result.stdout ?? ""}`,
  );
  if (result.status === 0 && version && Number(version[1]) >= 21) {
    if (directory) {
      environment.JAVA_HOME = directory;
      environment[pathKey] =
        `${path.join(directory, "bin")}${path.delimiter}${environment[pathKey] ?? ""}`;
    }
    javaFound = true;
    break;
  }
}
if (!javaFound) {
  console.error(
    "Instala Java 21 o superior y configura JAVA_HOME para ejecutar los emuladores.",
  );
  process.exit(1);
}
const mode = process.argv[2];
const args =
  mode === "start"
    ? ["emulators:start", "--only", "auth,firestore"]
    : mode === "auth"
      ? [
          "emulators:exec",
          "--only",
          "auth,firestore",
          `"${process.execPath}" scripts/test-onboarding.mjs`,
        ]
      : [
          "emulators:exec",
          "--only",
          "firestore",
          `"${process.execPath}" node_modules/vitest/vitest.mjs run tests/rules.test.ts`,
        ];
const result = spawnSync(
  process.execPath,
  [
    "node_modules/firebase-tools/lib/bin/firebase.js",
    ...args,
    "--project",
    "demo-registro-elec",
  ],
  { stdio: "inherit", env: environment, windowsHide: true },
);
process.exit(result.status ?? 1);
