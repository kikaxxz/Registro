import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const projectId = JSON.parse(readFileSync(".firebaserc", "utf8")).projects
  .default;
const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
const email = arg("--email");
const name = arg("--name");
const role = arg("--role") ?? "trabajador";
if (!email || !name || !["jefe", "trabajador"].includes(role)) {
  console.error(
    'Uso: npm run provision -- --email persona@empresa.com --name "Nombre Apellido" --role trabajador',
  );
  process.exit(1);
}
if (
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error(
    "Usa seed:demo para emuladores; provision es exclusivo para producción.",
  );
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();
let account;
try {
  account = await auth.getUserByEmail(email);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  account = await auth.createUser({
    email,
    displayName: name,
    emailVerified: false,
  });
}
const ref = db.doc(`users/${account.uid}`);
// Refuse to overwrite an existing employee, role, or lock by accident.
if ((await ref.get()).exists)
  throw new Error(
    "El perfil ya existe. No se modificó. Los cambios de rol requieren revisión manual en Firebase.",
  );
await ref.create({
  uid: account.uid,
  nombre: name,
  correo: account.email,
  rol: role,
  activo: true,
});
const settings = db.doc("settings/workday");
await db.runTransaction(async (tx) => {
  if (!(await tx.get(settings)).exists)
    tx.create(settings, {
      officialEntry: "07:00",
      officialExit: "16:00",
      normalMinutes: 480,
      toleranceMinutes: 10,
      overtimeRule: "after-normal",
      timeZone: "America/Managua",
    });
});
console.log(`Perfil creado: ${name} (${role}). UID: ${account.uid}`);
console.log(
  "La persona puede usar «Olvidé mi contraseña» para definir su contraseña. Este script no envía correos ni imprime enlaces de acceso.",
);
