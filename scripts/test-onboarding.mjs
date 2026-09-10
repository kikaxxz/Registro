import assert from "node:assert/strict";
import { businessService, digest } from "../cloudflare/src/business.mjs";
import { firestoreStore } from "../cloudflare/src/store.mjs";
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host || !process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error("Solo emuladores.");
const base = `http://${host}/identitytoolkit.googleapis.com/v1/accounts:`;
async function auth(method, body) {
  const r = await fetch(base + method + "?key=fake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message);
  return data;
}
const email = "onboarding-check@registro-elec.invalid",
  temporary = "Temporal12";
const created = await auth("signUp", {
  email,
  password: temporary,
  returnSecureToken: true,
});
const uid = created.localId;
const store = firestoreStore(
  "demo-registro-elec",
  async () => "owner",
  `http://${process.env.FIRESTORE_EMULATOR_HOST}`,
);
await store.transaction(async (tx) => {
  tx.set(`users/${uid}`, {
    uid,
    username: "onboarding-check",
    nombre: "Prueba",
    rol: "jefe",
    activo: true,
    mustChangePassword: true,
    canRegister: true,
  });
  tx.set(`onboardingSecrets/${uid}`, {
    temporaryHash: await digest(temporary),
  });
  tx.set("settings/workday", {
    officialEntry: "07:00",
    officialExit: "16:00",
    normalMinutes: 480,
    toleranceMinutes: 10,
    overtimeRule: "after-normal",
    timeZone: "America/Managua",
  });
});
const service = businessService(
  store,
  async (idToken, password, displayName) => {
    await auth("update", {
      idToken,
      password,
      displayName,
      returnSecureToken: true,
    });
  },
);
const login = await auth("signInWithPassword", {
  email,
  password: temporary,
  returnSecureToken: true,
});
await assert.rejects(
  () =>
    service.save(uid, {
      day: "2026-01-02",
      entry: "07:00",
      exit: "16:00",
      nextDay: false,
    }),
  /primer ingreso/,
);
await service.onboard(
  uid,
  { fullName: "Denis Pérez García", password: "Nueva1" },
  login.idToken,
);
await assert.rejects(() =>
  auth("signInWithPassword", {
    email,
    password: temporary,
    returnSecureToken: true,
  }),
);
const personal = await auth("signInWithPassword", {
  email,
  password: "Nueva1",
  returnSecureToken: true,
});
assert.equal(personal.localId, uid);
assert.equal((await service.session(uid)).profile.nombre, "Denis Pérez García");
assert.equal(await store.get(`onboardingSecrets/${uid}`), null);
const record = await service.save(uid, {
  day: "2026-01-02",
  entry: "07:00",
  exit: "16:00",
  nextDay: false,
});
assert.equal(
  (await store.get("attendance/" + record.id)).employeeName,
  "Denis Pérez García",
);
console.log(
  "Firebase Auth y Firestore reales en emulador: contraseña temporal reemplazada por una de seis caracteres, acceso inicial bloqueado, nombre completo guardado y jefe autorizado a registrar.",
);
