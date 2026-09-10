import { ApiError, timestamp } from "./store.mjs";
import { manualTimes, manualId } from "../../shared/manual.mjs";
import { validSettings } from "./service.mjs";
const fail = (message, status = 403) => {
  throw new ApiError(status, message);
};
export async function digest(value) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}
export function businessService(store, changePassword) {
  async function profile(uid, ready = true, boss = false) {
    const p = await store.get(`users/${uid}`);
    if (!p?.activo || !["jefe", "trabajador"].includes(p.rol))
      fail("Cuenta no habilitada.");
    if (ready && p.mustChangePassword === true)
      fail("Completa tu primer ingreso.", 428);
    if (boss && p.rol !== "jefe")
      fail("No tienes permiso para esta operación.");
    return p;
  }
  const visible = (p) => ({
    uid: p.uid,
    username: p.username,
    nombre: p.nombre,
    correo: p.correo ?? "",
    rol: p.rol,
    activo: p.activo,
    mustChangePassword: p.mustChangePassword === true,
    canRegister: p.canRegister !== false,
  });
  async function session(uid) {
    return { profile: visible(await profile(uid, false)) };
  }
  async function onboard(uid, body, token) {
    const p = await profile(uid, false);
    if (!p.mustChangePassword) fail("Tu primer ingreso ya está completo.", 409);
    const nombre =
      typeof body.fullName === "string"
        ? body.fullName.trim().replace(/\s+/g, " ")
        : "";
    if (
      nombre.length < 5 ||
      nombre.length > 120 ||
      !/^[\p{L}\p{M}]+(?:[ .’'-][\p{L}\p{M}]+)+$/u.test(nombre)
    )
      fail("Escribe tu nombre completo, incluyendo apellidos.", 400);
    const password = body.password;
    if (
      typeof password !== "string" ||
      password.length < 6 ||
      password.length > 128 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    )
      fail(
        "Usa al menos 6 caracteres, con mayúscula, minúscula y número.",
        400,
      );
    const secret = await store.get(`onboardingSecrets/${uid}`);
    if (secret?.temporaryHash === (await digest(password)))
      fail("Elige una contraseña distinta de la temporal.", 400);
    // Firebase updates the password before releasing business permissions. Failure stays gated.
    await changePassword(token, password, nombre);
    await store.transaction(async (tx) => {
      const current = await tx.get(`users/${uid}`);
      if (!current?.activo || !current.mustChangePassword)
        fail("Tu cuenta cambió. Inicia sesión otra vez.", 409);
      tx.set(
        `users/${uid}`,
        { ...current, nombre, mustChangePassword: false },
        ["onboardedAt"],
      );
      tx.delete(`onboardingSecrets/${uid}`);
    });
    return { completed: true };
  }
  async function save(uid, body) {
    const p = await profile(uid);
    if (p.canRegister === false) fail("Esta cuenta es solo administrativa.");
    let times;
    try {
      times = manualTimes(body);
    } catch (e) {
      fail(e.message, 400);
    }
    const id = manualId(uid, times.date);
    await store.transaction(async (tx) => {
      const fresh = await tx.get(`users/${uid}`);
      const existing = await tx.get(`attendance/${id}`);
      const policy = await tx.get("settings/workday");
      if (
        !fresh?.activo ||
        fresh.mustChangePassword ||
        fresh.canRegister === false
      )
        fail("Tu cuenta no puede registrar.");
      if (existing)
        fail("Ya guardaste una jornada para esa fecha. Revisa Historial.", 409);
      if (!validSettings(policy))
        fail("Jefatura debe configurar el horario.", 409);
      tx.set(
        `attendance/${id}`,
        {
          employeeId: uid,
          employeeName: fresh.nombre,
          source: "manual",
          status: "closed",
          date: timestamp(times.date),
          entryTime: timestamp(times.entryTime),
          exitTime: timestamp(times.exitTime),
          workedMinutes: null,
          overtimeMinutes: null,
          policy,
        },
        ["submittedAt"],
      );
    });
    return { id };
  }
  async function list(uid, body) {
    const p = await profile(uid);
    const { from, to } = body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      fail("Selecciona fechas válidas.", 400);
    const begin = Date.parse(from + "T00:00:00-06:00"),
      end = Date.parse(to + "T00:00:00-06:00") + 86400000;
    if (
      !Number.isFinite(begin) ||
      !Number.isFinite(end) ||
      end <= begin ||
      end - begin > 93 * 86400000
    )
      fail("Consulta un rango válido de hasta 93 días.", 400);
    if (p.rol !== "jefe" && body.employeeId && body.employeeId !== uid)
      fail("Solo puedes consultar tus registros.");
    const employee = p.rol === "jefe" ? body.employeeId : uid;
    const fields = [
      {
        fieldFilter: {
          field: { fieldPath: "entryTime" },
          op: "GREATER_THAN_OR_EQUAL",
          value: timestamp(begin),
        },
      },
      {
        fieldFilter: {
          field: { fieldPath: "entryTime" },
          op: "LESS_THAN",
          value: timestamp(end),
        },
      },
    ];
    if (employee)
      fields.push({
        fieldFilter: {
          field: { fieldPath: "employeeId" },
          op: "EQUAL",
          value: { stringValue: employee },
        },
      });
    const records = await store.query({
      from: [{ collectionId: "attendance" }],
      where: { compositeFilter: { op: "AND", filters: fields } },
      orderBy: [{ field: { fieldPath: "entryTime" }, direction: "DESCENDING" }],
      limit: 10001,
    });
    if (records.length > 10000)
      fail("Reduce el período: supera 10 000 registros.", 400);
    return { records };
  }
  async function employees(uid) {
    await profile(uid, true, true);
    return {
      employees: (
        await store.query({ from: [{ collectionId: "users" }], limit: 1000 })
      )
        .filter((p) => p.canRegister !== false)
        .map(visible)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }
  async function settings(uid) {
    await profile(uid);
    return { settings: await store.get("settings/workday") };
  }
  async function setSettings(uid, body) {
    await profile(uid, true, true);
    if (!validSettings(body.settings)) fail("Configuración inválida.", 400);
    const canonical = (v) => JSON.stringify(Object.entries(v ?? {}).sort());
    await store.transaction(async (tx) => {
      const p = await tx.get(`users/${uid}`),
        latest = await tx.get("settings/workday");
      if (!p?.activo || p.mustChangePassword || p.rol !== "jefe")
        fail("Permiso no disponible.");
      if (canonical(latest) !== canonical(body.baseline))
        fail(
          "Otro administrador cambió el horario. Recarga antes de guardar.",
          409,
        );
      tx.set("settings/workday", body.settings);
    });
    return { saved: true };
  }
  return { session, onboard, save, list, employees, settings, setSettings };
}
