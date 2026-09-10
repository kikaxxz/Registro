import {
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { authentication } from "../firebase/client";

// A future passkey provider must exchange a server-verified assertion for a Firebase token.
// No biometric or WebAuthn assertion is trusted locally.
export interface AuthProvider {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
}
export const emailAuthProvider: AuthProvider = {
  async signIn(email, password) {
    const auth = authentication();
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async signOut() {
    await signOut(authentication());
  },
  async resetPassword(email) {
    await sendPasswordResetEmail(authentication(), email.trim());
  },
};
