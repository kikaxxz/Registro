import { SignJWT, importPKCS8 } from "jose";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const timestamp = (value) => ({
  timestampValue: new Date(value).toISOString(),
});
const encode = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if ("timestampValue" in v) return v;
  return { mapValue: { fields: encodeFields(v) } };
};
export const encodeFields = (data) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
const decode = (v) => {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  return decodeFields(v.mapValue?.fields ?? {});
};
export const decodeFields = (data) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, decode(v)]));

let cachedToken;
export async function googleToken(env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT ?? "{}");
  if (account.project_id !== "registro-elec" || !account.private_key)
    throw new ApiError(503, "Servicio pendiente de configuración.");
  if (
    cachedToken?.email === account.client_email &&
    cachedToken.until > Date.now()
  )
    return cachedToken.token;
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok)
    throw new ApiError(503, "No se pudo conectar con la base de datos.");
  const value = await res.json();
  cachedToken = {
    email: account.client_email,
    token: value.access_token,
    until: Date.now() + (value.expires_in - 120) * 1000,
  };
  return cachedToken.token;
}

export function firestoreStore(
  projectId,
  getToken,
  host = "https://firestore.googleapis.com",
) {
  const prefix = `projects/${projectId}/databases/(default)/documents`;
  async function call(suffix, method = "GET", body) {
    const res = await fetch(`${host}/v1/${prefix}${suffix}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 404) {
      await res.text();
      return null;
    }
    const data = await res.json();
    if (!res.ok) {
      const e = new ApiError(
        res.status === 409 ? 409 : 503,
        "No se pudo confirmar la operación. Inténtalo de nuevo.",
      );
      e.retry = data.error?.status === "ABORTED";
      throw e;
    }
    return data;
  }
  async function get(path, transaction) {
    if (transaction) {
      const rows = await call(":batchGet", "POST", {
        documents: [`${prefix}/${path}`],
        transaction,
      });
      const found = rows?.find((row) => row.found)?.found;
      return found ? decodeFields(found.fields ?? {}) : null;
    }
    const result = await call(
      `/${path}${transaction ? `?transaction=${encodeURIComponent(transaction)}` : ""}`,
    );
    return result ? decodeFields(result.fields ?? {}) : null;
  }
  return {
    get,
    async query(structuredQuery) {
      const rows = await call(":runQuery", "POST", { structuredQuery });
      return (rows ?? [])
        .filter((row) => row.document)
        .map((row) => ({
          id: row.document.name.split("/").at(-1),
          ...decodeFields(row.document.fields ?? {}),
        }));
    },
    async transaction(fn) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { transaction } = await call(":beginTransaction", "POST", {
          options: { readWrite: {} },
        });
        const writes = [];
        try {
          const value = await fn({
            get: (path) => get(path, transaction),
            set(path, data, serverTimes = []) {
              writes.push({
                update: {
                  name: `${prefix}/${path}`,
                  fields: encodeFields(data),
                },
                ...(serverTimes.length
                  ? {
                      updateTransforms: serverTimes.map((fieldPath) => ({
                        fieldPath,
                        setToServerValue: "REQUEST_TIME",
                      })),
                    }
                  : {}),
              });
            },
            delete: (path) => writes.push({ delete: `${prefix}/${path}` }),
          });
          await call(":commit", "POST", { transaction, writes });
          return value;
        } catch (e) {
          await call(":rollback", "POST", { transaction }).catch(() => {});
          if (!e.retry || attempt === 2) throw e;
        }
      }
    },
  };
}
