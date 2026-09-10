import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const env = import.meta.env;
export const emulatorMode = env.VITE_USE_EMULATORS === "true";
export const firebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_PROJECT_ID &&
  env.VITE_FIREBASE_AUTH_DOMAIN &&
  env.VITE_FIREBASE_APP_ID,
);
if (emulatorMode && !["localhost", "127.0.0.1"].includes(location.hostname))
  throw new Error("Los emuladores solo se permiten en localhost.");
const app = firebaseConfigured
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
// Default Firestore cache is memory-only. Reuse its instance across Vite hot reloads.
export const db = app ? getFirestore(app) : null;
if (auth) auth.languageCode = "es";
if (emulatorMode && auth && db && !auth.emulatorConfig) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export function database() {
  if (!db) throw new Error("Firebase no está configurado.");
  return db;
}
export function authentication() {
  if (!auth) throw new Error("Firebase no está configurado.");
  return auth;
}
