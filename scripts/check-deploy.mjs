import { readFileSync } from "node:fs";
import { loadEnv } from "vite";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const target = JSON.parse(readFileSync(".firebaserc", "utf8")).projects.default;
for (const key of [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
]) {
  if (!env[key]) throw new Error(`Completa ${key} en .env antes de desplegar.`);
}
if (
  env.VITE_USE_EMULATORS === "true" ||
  env.VITE_FIREBASE_PROJECT_ID.startsWith("demo-")
)
  throw new Error("No se puede desplegar una configuración de emuladores.");
if (target !== env.VITE_FIREBASE_PROJECT_ID)
  throw new Error(
    "El proyecto de .firebaserc debe coincidir con VITE_FIREBASE_PROJECT_ID.",
  );
console.log(`Configuración de producción validada: ${target}`);
