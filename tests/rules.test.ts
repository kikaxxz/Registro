import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-registro-elec",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
}, 30000);
afterAll(async () => env?.cleanup());
it("deniega accesos directos incluso al jefe, impidiendo saltarse IP y primer ingreso", async () => {
  for (const uid of ["denis", "andy", null]) {
    const db = uid
      ? env.authenticatedContext(uid).firestore()
      : env.unauthenticatedContext().firestore();
    for (const name of [
      "users",
      "attendance",
      "settings",
      "activeShifts",
      "usernames",
      "onboardingSecrets",
      "devicePolicies",
    ]) {
      const ref = doc(db, name, "example");
      await assertFails(getDoc(ref));
      await assertFails(getDocs(collection(db, name)));
      await assertFails(setDoc(ref, { activo: true }));
      await assertFails(deleteDoc(ref));
    }
  }
}, 30000);
it("el backend guarda una jornada de jefe con nombre completo y auditoría en Firestore real", async () => {
  const { firestoreStore } = await import("../cloudflare/src/store.mjs");
  const { businessService } = await import("../cloudflare/src/business.mjs");
  const { policy } = await import("./device-fixtures.mjs");
  const store = firestoreStore(
    "demo-registro-elec",
    async () => "owner",
    "http://127.0.0.1:8080",
  );
  await store.transaction(async (tx: any) => {
    tx.set("users/boss", {
      uid: "boss",
      username: "boss",
      nombre: "Denis Pérez",
      rol: "jefe",
      activo: true,
      canRegister: true,
    });
    tx.set("settings/workday", policy);
  });
  const service = businessService(store, async () => {});
  const result = await service.save("boss", {
    day: "2026-01-02",
    entry: "22:00",
    exit: "06:00",
    nextDay: true,
  });
  const saved = await store.get("attendance/" + result.id);
  expect(saved.employeeName).toBe("Denis Pérez");
  expect(saved.submittedAt).toBeTruthy();
  const history = await service.list("boss", {
    from: "2026-01-01",
    to: "2026-01-03",
  });
  expect(history.records.some((r: any) => r.id === result.id)).toBe(true);
}, 30000);
