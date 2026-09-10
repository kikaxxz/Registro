import { authentication } from "../firebase/client";
const base = (import.meta.env.VITE_DEVICE_API_URL ?? "").replace(/\/$/, "");
export async function api<T>(
  path: string,
  body: object = {},
  anonymous = false,
): Promise<T> {
  if (!navigator.onLine) throw new Error("Necesitas conexión a Internet.");
  const user = authentication().currentUser;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!anonymous) {
    if (!user) throw new Error("Inicia sesión.");
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  const response = await fetch(base + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 403)
      window.dispatchEvent(
        new CustomEvent("access-denied", { detail: data.error }),
      );
    throw new Error(data.error ?? "No se pudo completar la operación.");
  }
  return data;
}
