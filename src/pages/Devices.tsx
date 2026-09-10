import { useEffect, useState } from "react";
import { Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import type { Profile } from "../types";
import { useEmployees } from "./Dashboard";
import {
  deviceApi,
  deviceMark,
  deviceRequest,
  registerDevice,
  type DeviceList,
} from "../services/devices";
const states = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  revoked: "Revocado",
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("es-NI", { timeZone: "America/Managua" })
    : "Sin uso";
export function Devices({ profile }: { profile: Profile }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCESO PERSONAL</span>
          <h1>Dispositivos vinculados</h1>
          <p>Cada usuario puede tener varios dispositivos aprobados.</p>
        </div>
        <Laptop size={28} />
      </div>
      {!deviceApi ? (
        <div className="panel settings-body">
          <h2>Servicio pendiente de conexión</h2>
          <p>
            La vinculación aún no está activa. Estamos preparando el servicio de
            verificación.
          </p>
        </div>
      ) : profile.rol === "jefe" ? (
        <BossDevices />
      ) : (
        <DevicePanel uid={profile.uid} boss={false} />
      )}
    </>
  );
}
function BossDevices() {
  const { employees, error } = useEmployees();
  const [selected, setSelected] = useState("");
  const uid = selected || employees[0]?.uid || "";
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="panel settings-body">
        <label>
          Trabajador
          <select value={uid} onChange={(e) => setSelected(e.target.value)}>
            <option value="" disabled>
              Selecciona un trabajador
            </option>
            {employees.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.nombre}
                {p.activo ? "" : " · Inactivo"}
              </option>
            ))}
          </select>
        </label>
        <p>
          Antes de aprobar, verifica presencialmente al trabajador y el
          dispositivo solicitado.
        </p>
      </div>
      {uid && <DevicePanel key={uid} uid={uid} boss />}
    </>
  );
}
function DevicePanel({ uid, boss }: { uid: string; boss: boolean }) {
  const [data, setData] = useState<DeviceList | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    deviceRequest<DeviceList>("/devices/list", { uid })
      .then((v) => {
        if (current) setData(v);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [uid, revision]);
  async function act(fn: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(success);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo confirmar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel device-panel">
      <div className="panel-heading">
        <div>
          <h2>{data?.name ?? "Consultando dispositivos…"}</h2>
          <p>
            {data
              ? data.enforced
                ? "Protección activa: cada marcación exige un dispositivo aprobado."
                : "Protección pendiente: la contraseña todavía permite marcar."
              : "Consultando el servicio de verificación."}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Actualizar dispositivos"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="settings-body">
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        {!boss && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                () => registerDevice(label),
                "Solicitud creada. Jefatura debe aprobar este dispositivo.",
              );
            }}
          >
            <label>
              Nombre del dispositivo
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                required
                placeholder="Ej.: Laptop personal"
              />
            </label>
            <p>
              Usa una credencial local, como Windows Hello o una llave de
              seguridad compatible. Las credenciales sincronizadas no se
              admiten. El desbloqueo puede pedir PIN o biometría.
            </p>
            <div className="device-actions">
              <button className="primary" disabled={busy || !label.trim()}>
                Solicitar vinculación
              </button>
              <button
                type="button"
                className="secondary"
                disabled={
                  busy || !data?.devices.some((d) => d.status === "approved")
                }
                onClick={() =>
                  void act(
                    () => deviceMark("verify"),
                    "Dispositivo verificado. Esta prueba no registra entrada ni salida.",
                  )
                }
              >
                Probar dispositivo
              </button>
            </div>
          </form>
        )}
        {data?.devices.length === 0 && (
          <div className="empty">
            <Laptop size={30} />
            <h3>No hay dispositivos registrados</h3>
            <p>El trabajador puede solicitar la vinculación desde su cuenta.</p>
          </div>
        )}
        <div className="device-list">
          {data?.devices.map((d) => (
            <article key={d.id} className="rule-card">
              <div className="device-heading">
                <h3>{d.label}</h3>
                <span
                  className={`badge ${d.status === "approved" ? "working" : ""}`}
                >
                  {states[d.status]}
                </span>
              </div>
              <p>
                Solicitado: {date(d.createdAt)}
                <br />
                Última comprobación: {date(d.lastUsedAt)}
                {d.reviewedAt && (
                  <>
                    <br />
                    Revisión: {date(d.reviewedAt)}
                  </>
                )}
              </p>
              {boss && (
                <div className="device-actions">
                  {d.status === "pending" ? (
                    <>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              deviceRequest("/devices/review", {
                                uid,
                                id: d.id,
                                status: "approved",
                              }),
                            "Dispositivo aprobado.",
                          )
                        }
                      >
                        Aprobar
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              deviceRequest("/devices/review", {
                                uid,
                                id: d.id,
                                status: "rejected",
                              }),
                            "Solicitud rechazada.",
                          )
                        }
                      >
                        Rechazar
                      </button>
                    </>
                  ) : d.status === "approved" ? (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () =>
                            deviceRequest("/devices/review", {
                              uid,
                              id: d.id,
                              status: "revoked",
                            }),
                          "Dispositivo revocado. Los demás conservan su estado.",
                        )
                      }
                    >
                      Revocar dispositivo
                    </button>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
        {boss && data && !data.enforced && (
          <div className="rule-card">
            <h3>
              <ShieldCheck size={18} /> Activar protección de marcaciones
            </h3>
            <p>
              Primero aprueba un dispositivo y pide al trabajador que pulse
              «Probar dispositivo». Después puedes exigirlo para cada entrada y
              salida. La recuperación por pérdida de equipos requiere aprobar
              otro dispositivo.
            </p>
            <button
              className="primary"
              disabled={
                busy ||
                !data.devices.some(
                  (d) => d.status === "approved" && d.lastUsedAt,
                )
              }
              onClick={() =>
                void act(
                  () =>
                    deviceRequest("/devices/enforce", { uid, enforced: true }),
                  "Protección activada. La contraseña por sí sola ya no permite marcar.",
                )
              }
            >
              Exigir dispositivo aprobado
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
