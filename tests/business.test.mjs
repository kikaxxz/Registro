import { describe, it, expect, vi } from "vitest";
import { businessService, digest } from "../cloudflare/src/business.mjs";
import { memoryStore, policy } from "./device-fixtures.mjs";
import worker from "../cloudflare/src/index.mjs";
function setup(patch = {}) {
  const store = memoryStore();
  store.seed("users/denis", {
    uid: "denis",
    username: "denis",
    nombre: "Denis",
    rol: "jefe",
    activo: true,
    canRegister: true,
    ...patch,
  });
  store.seed("users/andy", {
    uid: "andy",
    username: "andy",
    nombre: "Andy Pérez",
    rol: "trabajador",
    activo: true,
  });
  store.seed("settings/workday", policy);
  const change = vi.fn().mockResolvedValue(undefined);
  return { store, change, service: businessService(store, change) };
}
const manual = {
  day: "2026-01-02",
  entry: "07:00",
  exit: "16:00",
  nextDay: false,
};
describe("Acceso autenticado y primer ingreso", () => {
  it("admite cualquier IP y conserva sesión obligatoria y control de origen", async () => {
    const env = {
      PROJECT_ID: "registro-elec",
      APP_ORIGIN: "https://registro-elec.web.app",
      RP_ID: "registro-elec.web.app",
    };
    for (const ip of [
      undefined,
      "203.0.113.1",
      "2001:db8::1",
      "190.53.38.110",
    ]) {
      const headers = {
        Origin: env.APP_ORIGIN,
        "Content-Type": "application/json",
      };
      if (ip) headers["CF-Connecting-IP"] = ip;
      const request = (path) =>
        new Request("https://api.test" + path, {
          method: "POST",
          headers,
          body: "{}",
        });
      expect((await worker.fetch(request("/network"), env)).status).toBe(200);
      expect((await worker.fetch(request("/session"), env)).status).toBe(401);
      headers.Authorization = "Bearer invalid";
      expect((await worker.fetch(request("/session"), env)).status).toBe(401);
    }
    expect(
      (
        await worker.fetch(
          new Request("https://api.test/network", {
            method: "POST",
            headers: { Origin: "https://evil.example" },
            body: "{}",
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });
  it("bloquea datos y guardado hasta cambiar la contraseña y completar nombre", async () => {
    const { store, service, change } = setup({ mustChangePassword: true });
    store.seed("onboardingSecrets/denis", {
      temporaryHash: await digest("Temp12"),
    });
    expect((await service.session("denis")).profile.mustChangePassword).toBe(
      true,
    );
    for (const op of [
      () => service.save("denis", manual),
      () => service.settings("denis"),
      () => service.employees("denis"),
      () => service.list("denis", { from: "2026-01-01", to: "2026-01-03" }),
    ])
      await expect(op()).rejects.toThrow("primer ingreso");
    for (const body of [
      { fullName: "Denis Pérez", password: "Temp12" },
      { fullName: "Denis", password: "Nueva1" },
      { fullName: "Denis Pérez", password: "Abc12" },
    ])
      await expect(service.onboard("denis", body, "token")).rejects.toThrow();
    expect(change).not.toHaveBeenCalled();
    await service.onboard(
      "denis",
      { fullName: "Denis Pérez García", password: "Nueva1" },
      "token",
    );
    expect(change).toHaveBeenCalledWith(
      "token",
      "Nueva1",
      "Denis Pérez García",
    );
    expect((await service.session("denis")).profile).toMatchObject({
      nombre: "Denis Pérez García",
      mustChangePassword: false,
    });
    await expect(
      service.onboard(
        "denis",
        { fullName: "Otra Persona", password: "Clave2" },
        "token",
      ),
    ).rejects.toThrow("completo");
  });
  it("un fallo de Firebase no libera permisos", async () => {
    const { service, change } = setup({ mustChangePassword: true });
    change.mockRejectedValue(new Error("Firebase unavailable"));
    await expect(
      service.onboard(
        "denis",
        { fullName: "Denis Pérez", password: "Nueva1" },
        "token",
      ),
    ).rejects.toThrow();
    await expect(service.save("denis", manual)).rejects.toThrow(
      "primer ingreso",
    );
  });
  it("Denis registra como jefe y el registro conserva su nombre completo", async () => {
    const { service, store } = setup({ nombre: "Denis Pérez García" });
    const saved = await service.save("denis", manual);
    expect(await store.get("attendance/" + saved.id)).toMatchObject({
      employeeId: "denis",
      employeeName: "Denis Pérez García",
      source: "manual",
    });
    await expect(service.save("denis", manual)).rejects.toThrow("Ya guardaste");
    await expect(
      service.save("denis", { ...manual, day: "2099-01-01" }),
    ).rejects.toThrow("futuras");
  });
  it("impide suplantación, cambios de configuración de trabajadores y acceso inactivo", async () => {
    const { service, store } = setup();
    await expect(
      service.list("andy", {
        from: "2026-01-01",
        to: "2026-01-03",
        employeeId: "denis",
      }),
    ).rejects.toThrow("tus registros");
    await expect(
      service.setSettings("andy", { settings: policy, baseline: policy }),
    ).rejects.toThrow("permiso");
    store.seed("users/denis", { uid: "denis", rol: "jefe", activo: false });
    await expect(service.session("denis")).rejects.toThrow("habilitada");
  });
});
