import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError, firestoreStore, googleToken } from "./store.mjs";
import { businessService } from "./business.mjs";
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
async function identity(req, env) {
  const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, "Inicia sesión para continuar.");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${env.PROJECT_ID}`,
      audience: env.PROJECT_ID,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new ApiError(401, "Tu sesión venció. Vuelve a iniciar sesión.");
  }
  if (!payload.sub || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.sub))
    throw new ApiError(401, "Sesión inválida.");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!response.ok) throw new ApiError(401, "Tu sesión ya no está disponible.");
  const account = (await response.json()).users?.[0];
  if (
    !account ||
    account.localId !== payload.sub ||
    account.disabled ||
    Number(account.validSince ?? 0) > Number(payload.auth_time ?? 0)
  )
    throw new ApiError(401, "Vuelve a iniciar sesión.");
  return payload.sub;
}
export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origin === env.APP_ORIGIN
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          }
        : {}),
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.method === "GET" && new URL(req.url).pathname === "/health")
      return json({
        service: "registro-device-api",
        version: 2,
        configured: Boolean(
          env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_API_KEY,
        ),
      });
    if (origin !== env.APP_ORIGIN)
      return json({ error: "Origen no permitido." }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return json({ error: "Método no permitido." }, 405);
    if (
      env.PROJECT_ID !== "registro-elec" ||
      env.RP_ID !== "registro-elec.web.app" ||
      env.APP_ORIGIN !== "https://registro-elec.web.app"
    )
      return json({ error: "Configuración inválida." }, 503);
    try {
      // Compatibility for cached clients; network restrictions were removed by the owner.
      if (new URL(req.url).pathname === "/network")
        return json({ allowed: true });
      if (!req.headers.get("Content-Type")?.startsWith("application/json"))
        throw new ApiError(400, "Se requiere JSON.");
      const reader = req.body?.getReader();
      let chunks = [],
        size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 32768) {
            await reader.cancel();
            throw new ApiError(413, "Solicitud demasiado grande.");
          }
          chunks.push(value);
        }
      }
      let body;
      try {
        body = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
      } catch {
        throw new ApiError(400, "JSON inválido.");
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw new ApiError(400, "Solicitud inválida.");
      const uid = await identity(req, env);
      const service = businessService(
        firestoreStore(env.PROJECT_ID, () => googleToken(env)),
        async (token, password, displayName) => {
          const r = await fetch(
            "https://identitytoolkit.googleapis.com/v1/accounts:update?key=" +
              encodeURIComponent(env.FIREBASE_API_KEY),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idToken: token,
                password,
                displayName,
                returnSecureToken: true,
              }),
            },
          );
          const data = await r.json();
          if (!r.ok)
            throw new ApiError(
              400,
              data.error?.message?.includes("CREDENTIAL_TOO_OLD")
                ? "Inicia sesión de nuevo antes de cambiar la contraseña."
                : "No se pudo cambiar la contraseña. Comprueba sus requisitos e inicia sesión de nuevo.",
            );
        },
      );
      const route = new URL(req.url).pathname;
      if (route === "/session") return json(await service.session(uid));
      if (route === "/onboarding")
        return json(
          await service.onboard(
            uid,
            body,
            req.headers.get("Authorization").slice(7),
          ),
        );
      if (route === "/attendance/save")
  return json(await service.save(uid, body));

if (route === "/attendance/update")
  return json(await service.update(uid, body));

if (route === "/attendance/list")
  return json(await service.list(uid, body));
      if (route === "/employees") return json(await service.employees(uid));
      if (route === "/settings/get") return json(await service.settings(uid));
      if (route === "/settings/set")
        return json(await service.setSettings(uid, body));
      return json({ error: "Ruta no disponible." }, 404);
    } catch (e) {
      return json(
        {
          error:
            e instanceof ApiError
              ? e.message
              : "No se pudo confirmar la operación.",
        },
        e instanceof ApiError ? e.status : 500,
      );
    }
  },
};
