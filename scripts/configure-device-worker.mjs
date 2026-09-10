// Run only after Cloudflare authorization and a successful Worker deployment.
// Credentials flow directly to Wrangler stdin and never appear in console output or a file.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
const require = createRequire(import.meta.url);
const project = "registro-elec",
  accountId = "registro-device-verifier";
const { requireAuth } = require("firebase-tools/lib/requireAuth.js");
const { Client } = require("firebase-tools/lib/apiv2.js");
const account = require("firebase-tools/lib/auth.js").getProjectDefaultAccount(
  process.cwd(),
);
await requireAuth({
  project,
  cwd: process.cwd(),
  nonInteractive: true,
  user: account.user,
  tokens: account.tokens,
});
const iam = new Client({ urlPrefix: "https://iam.googleapis.com", auth: true });
const crm = new Client({
  urlPrefix: "https://cloudresourcemanager.googleapis.com",
  auth: true,
});
const email = `${accountId}@${project}.iam.gserviceaccount.com`;
const name = `projects/${project}/serviceAccounts/${email}`;
try {
  await iam.get(`/v1/${name}`);
} catch (e) {
  if (e.status !== 404 && e.context?.response?.statusCode !== 404) throw e;
  await iam.post(`/v1/projects/${project}/serviceAccounts`, {
    accountId,
    serviceAccount: { displayName: "Registro device verifier" },
  });
}
const current = await crm.post(`/v1/projects/${project}:getIamPolicy`, {});
const policy = current.body;
const member = `serviceAccount:${email}`;
policy.bindings ??= [];
let binding = policy.bindings.find(
  (b) => b.role === "roles/datastore.user" && !b.condition,
);
if (!binding) {
  binding = { role: "roles/datastore.user", members: [] };
  policy.bindings.push(binding);
}
if (!binding.members.includes(member)) {
  binding.members.push(member);
  await crm.post(`/v1/projects/${project}:setIamPolicy`, { policy });
}
const created = await iam.post(`/v1/${name}/keys`, {
  privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
  keyAlgorithm: "KEY_ALG_RSA_2048",
});
const serviceAccount = JSON.parse(
  Buffer.from(created.body.privateKeyData, "base64").toString("utf8"),
);
const env = loadEnv("production", process.cwd(), "VITE_");
const result = spawnSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "secret",
    "bulk",
    "--config",
    "cloudflare/wrangler.jsonc",
  ],
  {
    input: JSON.stringify({
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount),
      FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
    }),
    encoding: "utf8",
    windowsHide: true,
  },
);
if (result.status !== 0) {
  await iam.delete(`/v1/${created.body.name}`);
  throw new Error(
    "No se confirmó la instalación de secretos; se revocó la clave nueva. Revisa la conexión de Cloudflare antes de repetir.",
  );
}
console.log(
  "Secretos instalados en Cloudflare. Cuenta de servicio limitada a Firestore; no se guardaron claves en el repositorio.",
);
