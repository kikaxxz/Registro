// Administrative provisioning for the four accounts explicitly requested by the owner.
// Never prints passwords. Output is private and excluded from Firebase Hosting and Git.
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { firestoreStore } from "../cloudflare/src/store.mjs";
const project = "registro-elec";
if (
  JSON.parse(readFileSync(".firebaserc", "utf8")).projects.default !==
    project ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error("Destino administrativo incorrecto.");
const require = createRequire(import.meta.url),
  cli = require("firebase-tools/lib/auth.js"),
  account = cli.getProjectDefaultAccount(process.cwd());
if (!account) throw new Error("Falta sesión administrativa de Firebase.");
async function access() {
  return cli.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);
}
const app = initializeApp({
  projectId: project,
  credential: {
    async getAccessToken() {
      const t = await access();
      return { access_token: t.access_token, expires_in: 3600 };
    },
  },
});
const auth = getAuth(app),
  store = firestoreStore(project, async () => (await access()).access_token);
const team = [
  ["denis", "Denis", "jefe"],
  ["andy", "Andy", "trabajador"],
  ["chele", "Chele", "trabajador"],
  ["alvaro", "Alvaro", "trabajador"],
];
const planned = [];
try {
  for (const [username, name, rol] of team) {
    let user = null;
    try {
      user = await auth.getUserByEmail(username + "@registro-elec.invalid");
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }
    const profile = user ? await store.get("users/" + user.uid) : null;
    if (user && profile?.username !== username)
      throw new Error("Cuenta existente sin perfil coincidente: " + username);
    planned.push({ username, name, rol, user, profile });
  }
  const counts = {};
  for (const col of ["attendance", "activeShifts"])
    counts[col] = (
      await store.query({ from: [{ collectionId: col }], limit: 10001 })
    ).length;
  console.log(
    "Plan: Denis (jefe con registro), Andy, Chele y Alvaro; contraseña temporal y nombre obligatorio. Registros existentes: " +
      JSON.stringify(counts),
  );
  if (!process.argv.includes("--apply")) process.exit(0);
  mkdirSync(".private-access", { recursive: true });
  const credentials = [];
  const writePrivate = () =>
    writeFileSync(
      ".private-access/usuarios-temporales.html",
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Accesos privados del personal</title><style>body{font:18px system-ui;max-width:850px;margin:48px auto;padding:20px}table{border-collapse:collapse;width:100%}td,th{padding:16px;border-bottom:1px solid #ddd;text-align:left}code{font-size:20px}p{line-height:1.6}</style><h1>Accesos privados del personal</h1><p>Entrega a cada persona únicamente su usuario y contraseña. Al ingresar deberá crear una contraseña nueva y completar su nombre y apellidos. La contraseña temporal no caduca por tiempo; deja de funcionar cuando la cambia.</p><table><tr><th>Persona</th><th>Usuario</th><th>Contraseña temporal</th></tr>${credentials.map((v) => `<tr><td>${v.name}</td><td>${v.username}</td><td><code>${v.password}</code></td></tr>`).join("")}</table><p><a href="https://registro-elec.web.app/">Abrir Registro</a> · Acceso desde cualquier conexión a Internet.</p><p>Este archivo es privado. No lo publiques ni lo entregues completo a los trabajadores.</p></html>`,
      { mode: 0o600 },
    );
  for (const plan of planned) {
    const password = "Aa" + randomBytes(7).toString("hex") + "9";
    let user = plan.user;
    if (!user)
      user = await auth.createUser({
        email: plan.username + "@registro-elec.invalid",
        displayName: plan.name,
      });
    credentials.push({ name: plan.name, username: plan.username, password });
    writePrivate();
    await store.transaction(async (tx) => {
      tx.set("users/" + user.uid, {
        ...(plan.profile ?? {}),
        uid: user.uid,
        username: plan.username,
        nombre: plan.name,
        correo: plan.profile?.correo ?? "",
        rol: plan.rol,
        activo: true,
        canRegister: true,
        mustChangePassword: true,
      });
      tx.set("onboardingSecrets/" + user.uid, {
        temporaryHash: createHash("sha256").update(password).digest("hex"),
      });
      tx.set("usernames/" + plan.username, { passwordLinked: true });
    });
    await auth.updateUser(user.uid, { password, disabled: false });
    await auth.revokeRefreshTokens(user.uid);
    console.log("Preparado: " + plan.username);
  }
  // Preserve independent administration and its existing credential.
  try {
    const boss = await auth.getUserByEmail("jefatura@registro-elec.invalid");
    await store.transaction(async (tx) => {
      const p = await tx.get("users/" + boss.uid);
      if (p) tx.set("users/" + boss.uid, { ...p, canRegister: false });
    });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
  }
  if (process.argv.includes("--clear-attendance")) {
    for (const col of ["attendance", "activeShifts"]) {
      let removed = 0;
      while (true) {
        const rows = await store.query({
          from: [{ collectionId: col }],
          limit: 400,
        });
        if (!rows.length) break;
        await store.transaction(async (tx) => {
          for (const row of rows) tx.delete(col + "/" + row.id);
        });
        removed += rows.length;
      }
      console.log("Eliminados de " + col + ": " + removed);
    }
  }
  console.log(
    "Credenciales guardadas en .private-access/usuarios-temporales.html. No se enviaron mensajes.",
  );
} finally {
  await deleteApp(app);
}
