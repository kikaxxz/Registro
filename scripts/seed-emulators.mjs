import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
// Hard-coded local targets prevent accidental production seeding.
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
initializeApp({ projectId: "demo-registro-elec" });
const auth = getAuth();
const db = getFirestore();
const policy = {
  officialEntry: "07:00",
  officialExit: "16:00",
  normalMinutes: 480,
  toleranceMinutes: 10,
  overtimeRule: "after-normal",
  timeZone: "America/Managua",
};
if (!(await db.doc("settings/workday").get()).exists)
  await db.doc("settings/workday").set(policy);
const users = [
  ["demo-jefe", "Carlos Mendoza", "jefe@electricidad.test", "jefe"],
  ["demo-ana", "Ana López", "ana@electricidad.test", "trabajador"],
  ["demo-luis", "Luis Pérez", "luis@electricidad.test", "trabajador"],
  ["demo-maria", "María González", "maria@electricidad.test", "trabajador"],
  ["demo-pedro", "Pedro Ramírez", "pedro@electricidad.test", "trabajador"],
];
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Managua",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const midnight = new Date(`${day}T00:00:00-06:00`).getTime();
for (const [uid, nombre, correo, rol] of users) {
  try {
    await auth.getUser(uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({
      uid,
      email: correo,
      displayName: nombre,
      password: "PruebaElec2026!",
      emailVerified: true,
    });
  }
  if (!(await db.doc(`users/${uid}`).get()).exists)
    await db
      .doc(`users/${uid}`)
      .set({ uid, nombre, correo, rol, activo: true });
  if (rol !== "trabajador") continue;
  for (let d = 1; d <= 7; d++) {
    const ref = db.doc(`attendance/seed-${uid}-${day}-${d}`);
    if ((await ref.get()).exists) continue;
    const entry =
      midnight -
      d * 86400000 +
      7 * 3600000 +
      users.findIndex((u) => u[0] === uid) * 120000;
    const worked = 480 + ((d + users.findIndex((u) => u[0] === uid)) % 3) * 30;
    await ref.set({
      employeeId: uid,
      employeeName: nombre,
      date: Timestamp.fromMillis(entry),
      entryTime: Timestamp.fromMillis(entry),
      exitTime: Timestamp.fromMillis(entry + worked * 60000),
      workedMinutes: worked,
      overtimeMinutes: worked - 480,
      status: "closed",
      policy,
    });
  }
}
console.log("Datos ficticios creados en los emuladores locales.");
console.log(
  "Jefe: jefe@electricidad.test | Trabajadora: ana@electricidad.test",
);
console.log("Contraseña de pruebas: PruebaElec2026!");
