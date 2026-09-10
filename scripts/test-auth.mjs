import { spawnSync } from "node:child_process";
for (const script of ["scripts/seed-emulators.mjs", "tests/auth.smoke.mjs"]) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
