import {
  generateKeyPairSync,
  randomBytes,
  createHash,
  sign,
} from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
export const origin = "https://registro-elec.web.app";
export const rpID = "registro-elec.web.app";
const sha = (b) => createHash("sha256").update(b).digest();
export function authenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const jwk = publicKey.export({ format: "jwk" }),
    rawId = randomBytes(32),
    id = rawId.toString("base64url");
  const key = isoCBOR.encode(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, "base64url")],
      [-3, Buffer.from(jwk.y, "base64url")],
    ]),
  );
  let counter = 0;
  return {
    id,
    register(options, { flags = 0x45, source = origin } = {}) {
      const clientData = Buffer.from(
        JSON.stringify({
          type: "webauthn.create",
          challenge: options.challenge,
          origin: source,
        }),
      );
      const length = Buffer.alloc(2);
      length.writeUInt16BE(rawId.length);
      const authData = Buffer.concat([
        sha(rpID),
        Buffer.from([flags]),
        Buffer.alloc(4),
        Buffer.alloc(16),
        length,
        rawId,
        Buffer.from(key),
      ]);
      return {
        id,
        rawId: id,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientData.toString("base64url"),
          attestationObject: Buffer.from(
            isoCBOR.encode(
              new Map([
                ["fmt", "none"],
                ["attStmt", new Map()],
                ["authData", authData],
              ]),
            ),
          ).toString("base64url"),
        },
      };
    },
    authenticate(options, { flags = 0x05, source = origin } = {}) {
      const clientData = Buffer.from(
        JSON.stringify({
          type: "webauthn.get",
          challenge: options.challenge,
          origin: source,
        }),
      );
      const count = Buffer.alloc(4);
      count.writeUInt32BE(++counter);
      const authData = Buffer.concat([sha(rpID), Buffer.from([flags]), count]);
      const signature = sign(
        "sha256",
        Buffer.concat([authData, sha(clientData)]),
        privateKey,
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientData.toString("base64url"),
          authenticatorData: authData.toString("base64url"),
          signature: signature.toString("base64url"),
          userHandle: null,
        },
      };
    },
  };
}
export function memoryStore() {
  let map = new Map(),
    queue = Promise.resolve();
  return {
    seed(path, data) {
      map.set(path, structuredClone(data));
    },
    async get(path) {
      return structuredClone(map.get(path) ?? null);
    },
    transaction(fn) {
      const run = queue.then(async () => {
        const next = new Map(structuredClone([...map]));
        const result = await fn({
          get: async (p) => structuredClone(next.get(p) ?? null),
          set: (p, v, fields = []) =>
            next.set(p, {
              ...structuredClone(v),
              ...Object.fromEntries(
                fields.map((f) => [f, new Date().toISOString()]),
              ),
            }),
          delete: (p) => next.delete(p),
        });
        map = next;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
export const policy = {
  officialEntry: "07:00",
  officialExit: "16:00",
  normalMinutes: 480,
  toleranceMinutes: 10,
  overtimeRule: "after-normal",
  timeZone: "America/Managua",
};
