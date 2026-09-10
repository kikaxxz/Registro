import { getDocFromServer, doc } from "firebase/firestore";
import { authentication, database } from "../firebase/client";
import type { ManualInput } from "../../shared/manual.mjs";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
export const deviceApi = (import.meta.env.VITE_DEVICE_API_URL ?? "").replace(
  /\/$/,
  "",
);
export interface DeviceInfo {
  id: string;
  label: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  lastUsedAt: string | null;
}
export interface DeviceList {
  uid: string;
  name: string;
  enforced: boolean;
  devices: DeviceInfo[];
}
export async function deviceRequest<T>(path: string, body: object): Promise<T> {
  if (!deviceApi)
    throw new Error("La vinculación de dispositivos aún no está disponible.");
  const user = authentication().currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const response = await fetch(deviceApi + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo confirmar la operación.");
  return data;
}
export async function registerDevice(label: string) {
  const { options } = await deviceRequest<{
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/devices/register/options", { label });
  const response = await startRegistration({ optionsJSON: options });
  return deviceRequest("/devices/register/verify", { response });
}
export async function deviceMark(
  action: "entry" | "exit" | "verify" | "manual",
  attendanceId?: string,
  manual?: ManualInput,
) {
  const { options } = await deviceRequest<{
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/attendance/options", { action, attendanceId, manual });
  const response = await startAuthentication({ optionsJSON: options });
  return deviceRequest("/attendance/verify", { response });
}
export async function requiresDevice(uid: string) {
  const policy = await getDocFromServer(doc(database(), "devicePolicies", uid));
  return policy.exists() && policy.data().enforced !== false;
}
