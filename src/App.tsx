import { useEffect, useState } from "react";
import {
  Zap,
  LayoutDashboard,
  Clock3,
  ClipboardList,
  Settings2,
  LogOut,
  WifiOff,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "./hooks/useSession";
import { useOnline } from "./hooks/useOnline";
import { Login } from "./pages/Login";
import { Worker } from "./pages/Worker";
import { History } from "./pages/History";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";
import { emailAuthProvider } from "./services/auth";
import { emulatorMode } from "./firebase/client";
import { PwaControls } from "./components/PwaControls";
import { errorMessage } from "./utils/errors";
type Page = "home" | "history" | "settings" | "personnel";
export function App() {
  const { user, profile, loading, error } = useSession();
  const online = useOnline();
  const [page, setPage] = useState<Page>("home");
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    setPage("home");
  }, [user?.uid]);
  async function logout() {
    try {
      await emailAuthProvider.signOut();
      setLogoutError("");
    } catch (e) {
      setLogoutError(errorMessage(e));
    }
  }
  const connectionBanner = !online && (
    <div className="offline-bar" role="status">
      <WifiOff size={16} />
      Sin conexión. Los registros requieren conexión y confirmación del
      servidor.
    </div>
  );
  if (loading)
    return (
      <>
        {connectionBanner}
        <main className="access-state">
          <span className="brand-symbol">
            <Zap />
          </span>
          <h1>Verificando tu acceso…</h1>
          <p>No cierres esta ventana mientras se conecta.</p>
          {user && (
            <button className="text-button" onClick={logout}>
              Volver al inicio de sesión
            </button>
          )}
        </main>
      </>
    );
  if (!user)
    return (
      <>
        {connectionBanner}
        <Login />
        <PwaControls updatesOnly />
      </>
    );
  if (error || !profile || !profile.activo)
    return (
      <>
        {connectionBanner}
        <main className="access-state">
          <ShieldCheck size={36} />
          <h1>Acceso pendiente</h1>
          <p>
            {error || "No se encontró un perfil autorizado para esta cuenta."}
          </p>
          {logoutError && <p role="alert">{logoutError}</p>}
          <button className="primary" onClick={logout}>
            Cerrar sesión
          </button>
        </main>
      </>
    );
  if (profile.mustChangePassword) return <Onboarding profile={profile} />;
  const boss = profile.rol === "jefe";
  const tabs = [
    {
      id: "home" as Page,
      label: profile.canRegister === false ? "Personal" : "Registro",
      icon: Clock3,
    },
    {
      id: "history" as Page,
      label: boss ? "Historial" : "Mi historial",
      icon: ClipboardList,
    },
    ...(boss && profile.canRegister !== false
      ? [{ id: "personnel" as Page, label: "Personal", icon: LayoutDashboard }]
      : []),
    ...(boss
      ? [{ id: "settings" as Page, label: "Configuración", icon: Settings2 }]
      : []),
  ];
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Registro inicio">
          <span className="brand-symbol">
            <Zap size={24} />
          </span>
          <span>
            registro<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="area-label">ÁREA DE ELECTRICIDAD</div>
        <nav aria-label="Navegación principal">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="role-note">
            <ShieldCheck size={18} />
            <div>
              <strong>{boss ? "Jefe de área" : "Acceso de trabajador"}</strong>
              <span>Sesión personal y segura</span>
            </div>
          </div>
          <div className="sidebar-version">REGISTRO / v1.0</div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <span className="breadcrumb">
            Electricidad <span>/</span> {tabs.find((t) => t.id === page)?.label}
          </span>
          <div className="account">
            <PwaControls />
            <span className="account-name">
              {profile.nombre}
              <small>{boss ? "Jefe del área" : "Trabajador"}</small>
            </span>
            <span className="avatar">{profile.nombre.slice(0, 1)}</span>
            <button
              className="icon-button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        {connectionBanner}
        {emulatorMode && (
          <div className="demo-bar">
            ENTORNO LOCAL DE PRUEBAS · Datos ficticios
          </div>
        )}
        <main id="main" className="content" key={profile.uid + page}>
          {logoutError && (
            <div className="notice error" role="alert">
              {logoutError}
            </div>
          )}
          {page === "personnel" && boss ? (
            <Dashboard profile={profile} />
          ) : page === "home" ? (
            profile.canRegister === false ? (
              <Dashboard profile={profile} />
            ) : (
              <Worker profile={profile} />
            )
          ) : page === "history" ? (
            boss ? (
              <Dashboard profile={profile} historyOnly />
            ) : (
              <History profile={profile} />
            )
          ) : boss ? (
            <Settings />
          ) : null}
          <footer className="content-footer">
            <span>Registro · Área de Electricidad</span>
            <span>Horarios en hora de Nicaragua</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
