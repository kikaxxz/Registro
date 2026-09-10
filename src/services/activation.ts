import {
  confirmPasswordReset,
  verifyPasswordResetCode,
  validatePassword,
} from "firebase/auth";
import { doc, getDocFromServer, updateDoc } from "firebase/firestore";
import { authentication, database } from "../firebase/client";
import { normalizeUsername, usernameEmail } from "../utils/username";
import { emailAuthProvider } from "./auth";

export async function getUsernameState(
  username: string,
): Promise<"missing" | "pending" | "linked"> {
  const snapshot = await getDocFromServer(
    doc(database(), "usernames", normalizeUsername(username)),
  );
  return !snapshot.exists()
    ? "missing"
    : snapshot.data().passwordLinked
      ? "linked"
      : "pending";
}
export async function markPasswordLinked(username: string) {
  const ref = doc(database(), "usernames", normalizeUsername(username));
  const snapshot = await getDocFromServer(ref);
  if (snapshot.exists() && !snapshot.data().passwordLinked)
    await updateDoc(ref, { passwordLinked: true });
}
export async function verifyActivation(username: string, code: string) {
  if (!code)
    throw new Error(
      "Abre el enlace individual que te entregó el administrador.",
    );
  const email = await verifyPasswordResetCode(authentication(), code);
  if (email.toLowerCase() !== usernameEmail(username))
    throw new Error("Este enlace pertenece a otro usuario.");
}
export async function activateAccount(
  username: string,
  code: string,
  password: string,
) {
  await verifyActivation(username, code);
  if (
    password.length < 6 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    throw new Error(
      "Usa al menos 6 caracteres, una mayúscula, una minúscula y un número.",
    );
  const policy = await validatePassword(authentication(), password);
  if (!policy.isValid)
    throw new Error(
      "La contraseña no cumple la política de seguridad de Firebase.",
    );
  await confirmPasswordReset(authentication(), code, password);
  // A consumed action code cannot set the password a second time. Login can be retried independently.
  await emailAuthProvider.signIn(usernameEmail(username), password);
  await markPasswordLinked(username);
}
