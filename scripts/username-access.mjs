import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const username = (value("--username") ?? "")
  .trim()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();
const mode = value("--mode") ?? "create";
const displayName = value("--name");
const role = value("--role") ?? "trabajador";
if (
  !/^[a-z][a-z0-9._-]{2,31}$/.test(username) ||
  !["create", "activate", "recover"].includes(mode)
)
  throw new Error(
    "Indica --username usuario y --mode create, activate o recover.",
  );
if (
  mode === "create" &&
  (!displayName ||
    displayName.length > 120 ||
    !["jefe", "trabajador"].includes(role))
)
  throw new Error('Indica --name "Nombre" y --role jefe o trabajador.');
if (
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error("Este script es administrativo de producción.");
const projectId = JSON.parse(readFileSync(".firebaserc", "utf8")).projects
  .default;
if (projectId !== "registro-elec")
  throw new Error("Este proyecto debe ser registro-elec.");
const require = createRequire(import.meta.url);
const cliAuth = require("firebase-tools/lib/auth.js");
const account = cliAuth.getProjectDefaultAccount(process.cwd());
if (!account)
  throw new Error("Inicia sesión: npx -y firebase-tools@latest login");
async function token() {
  return cliAuth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);
}
initializeApp({
  projectId,
  credential: {
    async getAccessToken() {
      const result = await token();
      return { access_token: result.access_token, expires_in: 3600 };
    },
  },
});
const auth = getAuth();
const email = `${username}@registro-elec.invalid`;
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
async function firestore(suffix, method = "GET", body) {
  const result = await token();
  const response = await fetch(base + suffix, {
    method,
    headers: {
      Authorization: `Bearer ${result.access_token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      `Firestore ${response.status}: ${data.error?.message ?? "operación rechazada"}`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function fields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, val]) => [
      key,
      typeof val === "boolean" ? { booleanValue: val } : { stringValue: val },
    ]),
  );
}
let user;
if (mode === "create") {
  try {
    await firestore(`/usernames/${username}`);
    throw new Error(
      "El usuario ya existe. Usa activate o recover; no se cambian roles.",
    );
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  // Never adopt an existing Auth account: a publicly created account may belong to an attacker.
  user = await auth.createUser({ email, displayName, emailVerified: false });
  try {
    await firestore(":commit", "POST", {
      writes: [
        {
          update: {
            name: `projects/${projectId}/databases/(default)/documents/users/${user.uid}`,
            fields: fields({
              uid: user.uid,
              username,
              nombre: displayName,
              correo: "",
              rol: role,
              activo: true,
            }),
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: `projects/${projectId}/databases/(default)/documents/usernames/${username}`,
            fields: fields({ passwordLinked: false }),
          },
          currentDocument: { exists: false },
        },
      ],
    });
  } catch (e) {
    await auth.deleteUser(user.uid);
    throw e;
  }
} else {
  user = await auth.getUserByEmail(email);
  const profile = await firestore(`/users/${user.uid}`);
  if (
    profile.fields.username?.stringValue !== username ||
    profile.fields.activo?.booleanValue !== true
  )
    throw new Error("El perfil no coincide o está inactivo.");
  if (mode === "activate") {
    const state = await firestore(`/usernames/${username}`);
    if (state.fields.passwordLinked?.booleanValue || user.passwordHash)
      throw new Error(
        "La cuenta ya tiene contraseña. Usa recover tras verificar la identidad de la persona.",
      );
  }
}
const firebaseLink = await auth.generatePasswordResetLink(email);
const code = new URL(firebaseLink).searchParams.get("oobCode");
if (!code) throw new Error("Firebase no devolvió un código de activación.");
const link = new URL("https://registro-elec.web.app/");
link.hash = new URLSearchParams({
  user: username,
  mode: mode === "recover" ? "recover" : "activate",
  oobCode: code,
}).toString();
const directory = path.resolve(".private-access");
mkdirSync(directory, { recursive: true });
const output = path.join(
  directory,
  `${username}-${mode === "recover" ? "recuperacion" : "activacion"}.html`,
);
const safeLink = link.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
writeFileSync(
  output,
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Acceso privado de ${username}</title><body style="font:18px system-ui;max-width:600px;margin:60px auto;padding:20px"><h1>${mode === "recover" ? "Recuperar acceso" : "Activar cuenta"}: ${username}</h1><p>Este enlace es personal y de un solo uso. Entrégalo solo a su titular. Si vence, el administrador puede generar otro.</p><p><a href="${safeLink}">${mode === "recover" ? "Establecer nueva contraseña" : "Crear mi contraseña"}</a></p><p>No compartas este archivo en un repositorio ni lo publiques.</p></body></html>`,
  { mode: 0o600 },
);
console.log(
  `Cuenta ${username} preparada. Enlace privado guardado en ${output}. No se enviaron correos ni se imprimió el código.`,
);
