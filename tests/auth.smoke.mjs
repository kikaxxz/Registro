import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  terminate,
  updateDoc,
} from "firebase/firestore";
import {
  initializeApp as initializeAdminApp,
  deleteApp as deleteAdminApp,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
const app = initializeApp({
  apiKey: "demo-key",
  projectId: "demo-registro-elec",
  authDomain: "demo-registro-elec.firebaseapp.com",
});
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
try {
  await assert.rejects(
    signInWithEmailAndPassword(auth, "ana@electricidad.test", "Incorrecta!123"),
  );
  await signInWithEmailAndPassword(
    auth,
    "ana@electricidad.test",
    "PruebaElec2026!",
  );
  assert.equal(
    (await getDoc(doc(db, "users", auth.currentUser.uid))).data().rol,
    "trabajador",
  );
  await assert.rejects(
    getDocs(collection(db, "users")),
    (error) => error.code === "permission-denied",
  );
  await signOut(auth);
  await signInWithEmailAndPassword(
    auth,
    "jefe@electricidad.test",
    "PruebaElec2026!",
  );
  assert.equal(
    (await getDoc(doc(db, "users", auth.currentUser.uid))).data().rol,
    "jefe",
  );
  assert.equal((await getDocs(collection(db, "users"))).size, 5);
  await signOut(auth);
  await assert.rejects(
    getDoc(doc(db, "settings", "workday")),
    (error) => error.code === "permission-denied",
  );
  console.log(
    "Auth integrado: contraseña inválida, acceso trabajador, acceso jefe, permisos y cierre de sesión verificados.",
  );
  if (
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error("Las pruebas de activación requieren emuladores.");
  const adminApp = initializeAdminApp({ projectId: "demo-registro-elec" });
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getAdminFirestore(adminApp);
  try {
    const invited = await adminAuth.createUser({
      email: "primero@registro-elec.invalid",
      displayName: "Primero",
    });
    await adminDb
      .doc(`users/${invited.uid}`)
      .set({
        uid: invited.uid,
        username: "primero",
        nombre: "Primero",
        correo: "",
        activo: true,
        rol: "trabajador",
      });
    await adminDb.doc("usernames/primero").set({ passwordLinked: false });
    const action = await adminAuth.generatePasswordResetLink(invited.email);
    const code = new URL(action).searchParams.get("oobCode");
    assert.equal(await verifyPasswordResetCode(auth, code), invited.email);
    await assert.rejects(
      confirmPasswordReset(auth, "codigo-falso", "NuevaClave2026!"),
    );
    await assert.rejects(
      confirmPasswordReset(auth, code, "Clav1"),
      (error) => error.code === "auth/weak-password",
    );
    await confirmPasswordReset(auth, code, "Clave1");
    await assert.rejects(confirmPasswordReset(auth, code, "OtraClave2026!"));
    await signInWithEmailAndPassword(auth, invited.email, "Clave1");
    await updateDoc(doc(db, "usernames", "primero"), { passwordLinked: true });
    await assert.rejects(
      updateDoc(doc(db, "usernames", "primero"), { passwordLinked: false }),
    );
    await signOut(auth);
    assert.deepEqual((await getDoc(doc(db, "usernames", "primero"))).data(), {
      passwordLinked: true,
    });
    console.log(
      "Activación verificada: código válido, código falso rechazado, enlace de un solo uso, acceso y estado inmutable.",
    );
  } finally {
    await adminDb.terminate();
    await deleteAdminApp(adminApp);
  }
} finally {
  await terminate(db);
  await deleteApp(app);
}
