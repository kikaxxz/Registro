import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { emailAuthProvider } from "../services/auth";
import { usernameEmail } from "../utils/username";
import { firebaseConfigured } from "../firebase/client";
import { errorMessage } from "../utils/errors";
export function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await emailAuthProvider.signIn(usernameEmail(username), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-brand">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Zap size={25} />
          </span>
          <span>
            registro<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="login-story">
          <span className="eyebrow light">ÁREA DE ELECTRICIDAD</span>
          <h1>
            Tu jornada,
            <br />
            en orden.
          </h1>
          <p>
            Tu horario, tu equipo.
            <br />
            Todo en un mismo lugar.
          </p>
          <div className="circuit-line">
            <span />
            <Zap size={22} />
            <span />
          </div>
        </div>
        <div className="login-footer">
          <ShieldCheck size={18} />
          <span>Acceso personal con usuario y contraseña</span>
        </div>
      </section>
      <section className="login-side">
        <div className="login-card">
          <div className="login-icon">
            <Clock3 size={26} />
          </div>
          <span className="eyebrow">BIENVENIDO A REGISTRO</span>
          <h2>Comienza tu jornada</h2>
          <p className="muted">Ingresa con tu usuario y contraseña.</p>
          <form onSubmit={submit}>
            <label>
              Usuario
              <input
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Ej. Denis"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Contraseña
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="notice" role="status">
                {message}
              </div>
            )}
            <button
              className="primary full"
              disabled={busy || !firebaseConfigured}
            >
              {busy ? "Verificando…" : "Iniciar sesión"}
              <ArrowRight size={19} />
            </button>
            <div className="login-actions">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setMessage(
                    "Usa la contraseña temporal que te entregó el administrador. Al ingresar completarás tu nombre y crearás tu contraseña personal.",
                  )
                }
              >
                Primera vez
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setMessage(
                    "Contacta al administrador para que verifique tu identidad y te entregue una nueva contraseña temporal.",
                  )
                }
              >
                Olvidé mi contraseña
              </button>
            </div>
          </form>
          <div className="login-help">
            <LockKeyhole size={17} />
            <p>
              La contraseña temporal es solo para tu primer ingreso. No la
              compartas con otras personas.
            </p>
          </div>
        </div>
        <span className="login-bottom">
          ELECTRICIDAD · CONTROL DE ASISTENCIA
        </span>
      </section>
    </main>
  );
}
