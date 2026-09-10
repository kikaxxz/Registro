import { useState, type FormEvent } from "react";
import { UserRoundCheck, ArrowRight } from "lucide-react";
import type { Profile } from "../types";
import { api } from "../services/api";
import { emailAuthProvider } from "../services/auth";
import { usernameEmail } from "../utils/username";
import { errorMessage } from "../utils/errors";
export function Onboarding({ profile }: { profile: Profile }) {
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (password !== confirmation)
        throw new Error("Las contraseñas no coinciden.");
      await api("/onboarding", { fullName: name, password });
      await emailAuthProvider.signIn(
        usernameEmail(profile.username!),
        password,
      );
      window.location.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-state onboarding">
      <div className="panel">
        <UserRoundCheck size={36} />
        <span className="eyebrow">PRIMER INGRESO</span>
        <h1>Haz tuya tu cuenta</h1>
        <p>
          Completa tu nombre y reemplaza la contraseña temporal para continuar.
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Nombre completo
              <input
                required
                autoComplete="name"
                placeholder="Nombres y apellidos"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="footnote">
              Este nombre aparecerá en tus registros y en el PDF.
            </p>
            <label>
              Nueva contraseña
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <p className="footnote">
              Mínimo 6 caracteres, con mayúscula, minúscula y número. Debe ser
              distinta de la temporal.
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button className="primary full">
              {busy ? "Guardando…" : "Guardar y continuar"}
              <ArrowRight size={18} />
            </button>
          </fieldset>
        </form>
        <button
          className="text-button"
          onClick={() => emailAuthProvider.signOut()}
          disabled={busy}
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
