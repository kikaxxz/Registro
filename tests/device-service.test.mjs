import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { deviceService } from "../cloudflare/src/service.mjs";
import worker from "../cloudflare/src/index.mjs";
import {
  authenticator,
  memoryStore,
  origin,
  rpID,
  policy,
} from "./device-fixtures.mjs";
let store, service, now;
beforeEach(() => {
  now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  store = memoryStore();
  service = deviceService(store, { origin, rpID });
  for (const [uid, rol] of [
    ["ana", "trabajador"],
    ["luis", "trabajador"],
    ["jefe", "jefe"],
  ])
    store.seed(`users/${uid}`, { uid, nombre: uid, rol, activo: true });
  store.seed("settings/workday", policy);
});
afterEach(() => vi.restoreAllMocks());
async function opts(kind, body, uid = "ana") {
  now += 4000;
  return (await service.options(uid, kind, body)).options;
}
async function enroll(label = "Laptop", uid = "ana") {
  const key = authenticator();
  await service.register(uid, {
    response: key.register(await opts("register", { label }, uid)),
  });
  return key;
}
async function approve(key, uid = "ana") {
  await service.review("jefe", { uid, id: key.id, status: "approved" });
}
async function proof(key, action = "verify", attendanceId) {
  return {
    response: key.authenticate(
      await opts("authenticate", { action, attendanceId }),
    ),
  };
}
describe("Vinculación con firmas WebAuthn reales", () => {
  it("firma el horario declarado, conserva auditoría y rechaza duplicados y horas futuras", async () => {
    const key = await enroll();
    await approve(key);
    const manual = {
      day: "2026-01-02",
      entry: "07:00",
      exit: "16:00",
      nextDay: false,
    };
    const options = await opts("authenticate", { action: "manual", manual });
    const result = await service.authenticate("ana", {
      response: key.authenticate(options),
      manual: { ...manual, exit: "23:00" },
    });
    const saved = await store.get(`attendance/${result.attendanceId}`);
    expect(saved.source).toBe("manual");
    expect(saved.exitTime.timestampValue).toBe("2026-01-02T22:00:00.000Z");
    expect(saved.submittedAt).toBeTruthy();
    const second = await opts("authenticate", { action: "manual", manual });
    await expect(
      service.authenticate("ana", { response: key.authenticate(second) }),
    ).rejects.toThrow("Ya guardaste");
    await expect(
      opts("authenticate", {
        action: "manual",
        manual: { ...manual, day: "2099-01-01" },
      }),
    ).rejects.toThrow("futuras");
  });
  it("permite dos dispositivos, exige aprobación, revoca uno sin afectar al otro", async () => {
    const one = await enroll("Laptop"),
      two = await enroll("Llave");
    await expect(opts("authenticate", { action: "verify" })).rejects.toThrow(
      "aprobado",
    );
    await approve(one);
    await approve(two);
    await expect(
      service.enforce("jefe", { uid: "ana", enforced: true }),
    ).rejects.toThrow("Probar dispositivo");
    await service.authenticate("ana", await proof(one));
    await service.enforce("jefe", { uid: "ana", enforced: true });
    await service.review("jefe", { uid: "ana", id: one.id, status: "revoked" });
    await expect(service.authenticate("ana", await proof(one))).rejects.toThrow(
      "revocado",
    );
    await expect(
      service.authenticate("ana", await proof(two)),
    ).resolves.toMatchObject({ verified: true });
    const view = await service.inspect("jefe", "ana");
    expect(view.devices).toHaveLength(2);
    expect(view.enforced).toBe(true);
    expect(JSON.stringify(view)).not.toContain("publicKey");
  });
  it("rechaza autopromoción, acceso cruzado, reactivación y desactivar la protección", async () => {
    const key = await enroll();
    await expect(
      service.review("ana", { uid: "ana", id: key.id, status: "approved" }),
    ).rejects.toThrow("permiso");
    await expect(service.inspect("luis", "ana")).rejects.toThrow("permiso");
    await approve(key);
    await service.review("jefe", { uid: "ana", id: key.id, status: "revoked" });
    await expect(approve(key)).rejects.toThrow("revisada");
    await expect(
      service.enforce("jefe", { uid: "ana", enforced: false }),
    ).rejects.toThrow("Solo");
  });
  it("rechaza registro sin verificación local, origen falso y credencial sincronizable", async () => {
    const key = authenticator();
    for (const extra of [
      { flags: 0x41 },
      { source: "https://evil.example" },
      { flags: 0x4d },
    ]) {
      const options = await opts("register", { label: "Equipo" });
      await expect(
        service.register("ana", { response: key.register(options, extra) }),
      ).rejects.toThrow();
    }
  });
  it("rechaza firma manipulada, repetición, vencimiento y dispositivo de otro usuario", async () => {
    const key = await enroll();
    await approve(key);
    const packet = await proof(key);
    const fake = structuredClone(packet);
    fake.response.response.signature = "AAAA";
    await expect(service.authenticate("ana", fake)).rejects.toThrow(
      "verificar",
    );
    await expect(service.authenticate("luis", packet)).rejects.toThrow();
    await service.authenticate("ana", packet);
    await expect(service.authenticate("ana", packet)).rejects.toThrow(
      "utilizada",
    );
    const expired = await proof(key);
    now += 121000;
    await expect(service.authenticate("ana", expired)).rejects.toThrow(
      "venció",
    );
  });
  it("vincula la operación al desafío y guarda entrada/salida solo una vez", async () => {
    const key = await enroll();
    await approve(key);
    const request = await proof(key, "entry");
    request.action = "exit";
    const values = await Promise.allSettled([
      service.authenticate("ana", request),
      service.authenticate("ana", request),
    ]);
    expect(values.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    const lock = await store.get("activeShifts/ana");
    expect(lock).toBeTruthy();
    await expect(
      service.authenticate("ana", await proof(key, "entry")),
    ).rejects.toThrow("jornada abierta");
    await service.authenticate(
      "ana",
      await proof(key, "exit", lock.attendanceId),
    );
    expect(await store.get("activeShifts/ana")).toBeNull();
    expect(await store.get(`attendance/${lock.attendanceId}`)).toMatchObject({
      status: "closed",
      employeeId: "ana",
      policy,
    });
  });
  it("vuelve a comprobar revocación y cuenta activa después de emitir el desafío", async () => {
    const key = await enroll();
    await approve(key);
    const packet = await proof(key, "entry");
    await service.review("jefe", { uid: "ana", id: key.id, status: "revoked" });
    await expect(service.authenticate("ana", packet)).rejects.toThrow(
      "revocado",
    );
    const two = await enroll("Segundo");
    await approve(two);
    const second = await proof(two, "entry");
    store.seed("users/ana", {
      uid: "ana",
      nombre: "Ana",
      rol: "trabajador",
      activo: false,
    });
    await expect(service.authenticate("ana", second)).rejects.toThrow(
      "habilitada",
    );
    expect(await store.get("activeShifts/ana")).toBeNull();
  });
  it("limita solicitudes y rechaza credenciales duplicadas", async () => {
    const options = await opts("register", { label: "Equipo" });
    await expect(
      service.options("ana", "register", { label: "Otro" }),
    ).rejects.toThrow("Espera");
    const key = authenticator();
    const response = key.register(options);
    await service.register("ana", { response });
    await expect(service.register("ana", { response })).rejects.toThrow(
      "utilizada",
    );
    await expect(opts("register", { label: "x".repeat(61) })).rejects.toThrow(
      "60",
    );
  });
});
describe("Frontera HTTP", () => {
  const env = { APP_ORIGIN: origin, RP_ID: rpID, PROJECT_ID: "registro-elec" };
  it("no admite otro origen ni peticiones sin token", async () => {
    const other = await worker.fetch(
      new Request("https://api.test/devices/list", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
      env,
    );
    expect(other.status).toBe(403);
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const anonymous = await worker.fetch(
      new Request("https://api.test/devices/list", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      }),
      env,
    );
    expect(anonymous.status).toBe(401);
  });
});
