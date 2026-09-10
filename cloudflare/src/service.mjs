import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { ApiError } from "./store.mjs";
import { timestamp } from "./store.mjs";
import { manualId, manualTimes } from "../../shared/manual.mjs";

function parseManual(input) {
  try {
    return manualTimes(input);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}

const MAX_DEVICES = 12;
const id = () => crypto.randomUUID();
const devicePath = (uid) => `deviceAccounts/${uid}`;
const challengePath = (uid) => `deviceChallenges/${uid}`;
const fail = (message, status = 403) => {
  throw new ApiError(status, message);
};
const cleanId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(value);
const publicDevice = ({
  id,
  label,
  status,
  createdAt,
  reviewedAt,
  reviewedBy,
  lastUsedAt,
}) => ({
  id,
  label,
  status,
  createdAt,
  reviewedAt: reviewedAt ?? null,
  reviewedBy: reviewedBy ?? null,
  lastUsedAt: lastUsedAt ?? null,
});
export function requireProfile(profile, role) {
  if (!profile?.activo || !["jefe", "trabajador"].includes(profile.rol))
    fail("Tu cuenta no está habilitada.");
  if (role && profile.rol !== role)
    fail("No tienes permiso para esta operación.");
}
function readChallenge(value, uid, kind) {
  if (
    !value ||
    value.uid !== uid ||
    value.kind !== kind ||
    value.used ||
    value.expires < Date.now()
  )
    fail(
      "La comprobación venció o ya fue utilizada. Repite la operación.",
      409,
    );
  return value;
}
export function deviceService(
  store,
  { origin, rpID },
  verifier = { verifyRegistrationResponse, verifyAuthenticationResponse },
) {
  async function profile(tx, uid, role) {
    const p = await tx.get(`users/${uid}`);
    requireProfile(p, role);
    return p;
  }
  async function options(uid, kind, body) {
    const p = await store.get(`users/${uid}`);
    requireProfile(p, "trabajador");
    const current = (await store.get(devicePath(uid))) ?? { devices: [] };
    let generated;
    let extra = {};
    if (kind === "register") {
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!label || label.length > 60)
        fail("Escribe un nombre de dispositivo de hasta 60 caracteres.", 400);
      if (current.devices.length >= MAX_DEVICES)
        fail(
          "Límite de 12 solicitudes por usuario alcanzado. Contacta con jefatura.",
          409,
        );
      generated = await generateRegistrationOptions({
        rpName: "Registro · Electricidad",
        rpID,
        userName: p.username ?? p.nombre,
        userID: new TextEncoder().encode(uid),
        attestationType: "none",
        supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: current.devices.map((d) => ({ id: d.id })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });
      extra = { label };
    } else {
      if (!["entry", "exit", "verify", "manual"].includes(body.action))
        fail("Operación inválida.", 400);
      if (body.action === "manual") parseManual(body.manual);
      if (body.action === "exit" && !cleanId(body.attendanceId))
        fail("Jornada inválida.", 400);
      const approved = current.devices.filter((d) => d.status === "approved");
      if (!approved.length)
        fail("Necesitas un dispositivo aprobado por jefatura.");
      generated = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: approved.map((d) => ({ id: d.id })),
      });
      extra = {
        action: body.action,
        attendanceId: body.action === "exit" ? body.attendanceId : null,
        ...(body.action === "manual"
          ? {
              manual: {
                day: body.manual.day,
                entry: body.manual.entry,
                exit: body.manual.exit,
                nextDay: body.manual.nextDay,
              },
            }
          : {}),
      };
    }
    await store.transaction(async (tx) => {
      await profile(tx, uid, "trabajador");
      const previous = await tx.get(challengePath(uid));
      if (previous && Date.now() - previous.issued < 3000)
        fail("Espera unos segundos antes de repetir.", 429);
      tx.set(challengePath(uid), {
        uid,
        kind,
        challenge: generated.challenge,
        issued: Date.now(),
        expires: Date.now() + 120000,
        used: false,
        ...extra,
      });
    });
    return { options: generated };
  }
  async function register(uid, body) {
    const ch = readChallenge(
      await store.get(challengePath(uid)),
      uid,
      "register",
    );
    let verified;
    try {
      verified = await verifier.verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch {
      fail("No se pudo verificar la credencial. Repite el registro.", 400);
    }
    if (!verified.verified) fail("Credencial inválida.", 400);
    const { credential, credentialDeviceType, credentialBackedUp } =
      verified.registrationInfo;
    // A synchronized passkey cannot enforce the requested one-physical-device boundary.
    if (credentialDeviceType !== "singleDevice" || credentialBackedUp)
      fail(
        "Esta credencial puede sincronizarse entre equipos. Usa una credencial local de Windows Hello o una llave de seguridad compatible.",
        400,
      );
    if (!cleanId(credential.id))
      fail("Identificador de credencial inválido.", 400);
    return store.transaction(async (tx) => {
      await profile(tx, uid, "trabajador");
      const latest = readChallenge(
        await tx.get(challengePath(uid)),
        uid,
        "register",
      );
      const account = (await tx.get(devicePath(uid))) ?? { devices: [] };
      const owner = await tx.get(`deviceCredentialOwners/${credential.id}`);
      if (
        latest.challenge !== ch.challenge ||
        owner ||
        account.devices.length >= MAX_DEVICES
      )
        fail(
          "El registro cambió o la credencial ya existe. Repite el proceso.",
          409,
        );
      const device = {
        id: credential.id,
        label: ch.label,
        status: "pending",
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        createdAt: new Date().toISOString(),
      };
      tx.set(devicePath(uid), { devices: [...account.devices, device] });
      tx.set(`deviceCredentialOwners/${credential.id}`, { uid });
      tx.set(challengePath(uid), { ...latest, used: true });
      return { device: publicDevice(device) };
    });
  }
  async function inspect(uid, target = uid) {
    if (!cleanId(target)) fail("Usuario inválido.", 400);
    return store.transaction(async (tx) => {
      await profile(tx, uid, target === uid ? undefined : "jefe");
      const p = await profile(tx, target);
      const account = (await tx.get(devicePath(target))) ?? { devices: [] };
      const policy = await tx.get(`devicePolicies/${target}`);
      return {
        uid: target,
        name: p.nombre,
        enforced: policy?.enforced === true,
        devices: account.devices.map(publicDevice),
      };
    });
  }
  async function review(uid, body) {
    if (
      !cleanId(body.uid) ||
      !cleanId(body.id) ||
      !["approved", "rejected", "revoked"].includes(body.status)
    )
      fail("Solicitud inválida.", 400);
    return store.transaction(async (tx) => {
      await profile(tx, uid, "jefe");
      await profile(tx, body.uid, "trabajador");
      const account = await tx.get(devicePath(body.uid));
      const d = account?.devices.find((d) => d.id === body.id);
      if (
        !d ||
        !(
          (d.status === "pending" &&
            ["approved", "rejected"].includes(body.status)) ||
          (d.status === "approved" && body.status === "revoked")
        )
      )
        fail("Esta solicitud ya fue revisada. Actualiza la lista.", 409);
      const updated = {
        ...d,
        status: body.status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: uid,
      };
      tx.set(devicePath(body.uid), {
        devices: account.devices.map((v) => (v.id === d.id ? updated : v)),
      });
      tx.set(
        `deviceAudit/${id()}`,
        { actor: uid, uid: body.uid, deviceId: d.id, action: body.status },
        ["at"],
      );
      return { device: publicDevice(updated) };
    });
  }
  async function enforce(uid, body) {
    if (!cleanId(body.uid) || body.enforced !== true)
      fail("Solo se permite activar la protección desde este panel.", 400);
    return store.transaction(async (tx) => {
      await profile(tx, uid, "jefe");
      await profile(tx, body.uid, "trabajador");
      const account = await tx.get(devicePath(body.uid));
      if (
        !account?.devices.some((d) => d.status === "approved" && d.lastUsedAt)
      )
        fail(
          "Primero aprueba un dispositivo y pide al trabajador que complete «Probar dispositivo».",
          409,
        );
      tx.set(`devicePolicies/${body.uid}`, { enforced: true, enabledBy: uid }, [
        "enabledAt",
      ]);
      tx.set(
        `deviceAudit/${id()}`,
        { actor: uid, uid: body.uid, action: "enforce" },
        ["at"],
      );
      return { enforced: true };
    });
  }
  async function authenticate(uid, body) {
    const ch = readChallenge(
      await store.get(challengePath(uid)),
      uid,
      "authenticate",
    );
    const account = await store.get(devicePath(uid));
    const d = account?.devices.find(
      (d) => d.id === body.response?.id && d.status === "approved",
    );
    if (!d) fail("Dispositivo pendiente, revocado o no autorizado.");
    let result;
    try {
      result = await verifier.verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: d.id,
          publicKey: Buffer.from(d.publicKey, "base64url"),
          counter: d.counter,
        },
        requireUserVerification: true,
      });
    } catch {
      fail("No se pudo verificar el dispositivo. Repite la operación.", 400);
    }
    if (
      !result.verified ||
      result.authenticationInfo.credentialDeviceType !== "singleDevice" ||
      result.authenticationInfo.credentialBackedUp
    )
      fail("Se requiere una credencial local verificada.", 400);
    return store.transaction(async (tx) => {
      const p = await profile(tx, uid, "trabajador");
      const latest = readChallenge(
        await tx.get(challengePath(uid)),
        uid,
        "authenticate",
      );
      const fresh = await tx.get(devicePath(uid));
      const device = fresh?.devices.find((v) => v.id === d.id);
      if (
        latest.challenge !== ch.challenge ||
        !device ||
        device.status !== "approved" ||
        device.counter !== d.counter
      )
        fail("El permiso cambió. Repite la operación.", 409);
      const lock = ["verify", "manual"].includes(ch.action)
        ? null
        : await tx.get(`activeShifts/${uid}`);
      const settings = ["entry", "manual"].includes(ch.action)
        ? await tx.get("settings/workday")
        : null;
      const manual = ch.action === "manual" ? parseManual(ch.manual) : null;
      const manualRecordId = manual ? manualId(uid, manual.date) : null;
      if (manual) {
        const existing = await tx.get(`attendance/${manualRecordId}`);
        if (existing)
          fail(
            "Ya guardaste una jornada para esa fecha. Puedes consultarla en Historial.",
            409,
          );
        if (!validSettings(settings))
          fail("Jefatura debe configurar una jornada válida.", 409);
      }
      const record =
        ch.action === "exit" && lock
          ? await tx.get(`attendance/${lock.attendanceId}`)
          : null;
      if (ch.action === "entry") {
        if (lock) fail("Ya tienes una jornada abierta.", 409);
        if (!validSettings(settings))
          fail("Jefatura debe configurar una jornada válida.", 409);
      }
      if (
        ch.action === "exit" &&
        (!lock ||
          lock.attendanceId !== ch.attendanceId ||
          record?.employeeId !== uid ||
          record?.status !== "open")
      )
        fail("La jornada cambió o ya está cerrada.", 409);
      // All authorization reads share the same transaction as attendance and nonce consumption.
      tx.set(challengePath(uid), { ...latest, used: true });
      tx.set(devicePath(uid), {
        devices: fresh.devices.map((v) =>
          v.id === d.id
            ? {
                ...v,
                counter: result.authenticationInfo.newCounter,
                lastUsedAt: new Date().toISOString(),
              }
            : v,
        ),
      });
      let attendanceId = null;
      if (manual) {
        attendanceId = manualRecordId;
        tx.set(
          `attendance/${attendanceId}`,
          {
            employeeId: uid,
            employeeName: p.nombre,
            source: "manual",
            status: "closed",
            date: timestamp(new Date(manual.date).toISOString()),
            entryTime: timestamp(new Date(manual.entryTime).toISOString()),
            exitTime: timestamp(new Date(manual.exitTime).toISOString()),
            workedMinutes: null,
            overtimeMinutes: null,
            policy: settings,
          },
          ["submittedAt"],
        );
      } else if (ch.action === "entry") {
        attendanceId = id();
        tx.set(
          `attendance/${attendanceId}`,
          {
            employeeId: uid,
            employeeName: p.nombre,
            exitTime: null,
            status: "open",
            workedMinutes: null,
            overtimeMinutes: null,
            policy: settings,
          },
          ["date", "entryTime"],
        );
        tx.set(`activeShifts/${uid}`, { employeeId: uid, attendanceId }, [
          "entryTime",
        ]);
      } else if (ch.action === "exit") {
        attendanceId = lock.attendanceId;
        const { timestamp } = await import("./store.mjs");
        tx.set(
          `attendance/${attendanceId}`,
          {
            ...record,
            date: timestamp(record.date),
            entryTime: timestamp(record.entryTime),
            status: "closed",
          },
          ["exitTime"],
        );
        tx.delete(`activeShifts/${uid}`);
      }
      tx.set(
        `deviceAudit/${id()}`,
        { actor: uid, uid, deviceId: d.id, action: ch.action, attendanceId },
        ["at"],
      );
      return { verified: true, action: ch.action, attendanceId };
    });
  }
  return { options, register, inspect, review, enforce, authenticate };
}
export function validSettings(p) {
  return (
    p &&
    Object.keys(p).length === 6 &&
    /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(p.officialEntry) &&
    /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(p.officialExit) &&
    Number.isInteger(p.normalMinutes) &&
    p.normalMinutes >= 1 &&
    p.normalMinutes <= 1440 &&
    Number.isInteger(p.toleranceMinutes) &&
    p.toleranceMinutes >= 0 &&
    p.toleranceMinutes <= 120 &&
    p.overtimeRule === "after-normal" &&
    p.timeZone === "America/Managua"
  );
}
