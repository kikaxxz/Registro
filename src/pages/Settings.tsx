import { useEffect, useState, type FormEvent } from "react";
import { api } from "../services/api";
import { Save, SlidersHorizontal } from "lucide-react";

import { useWorkday } from "../hooks/useWorkday";
import { errorMessage } from "../utils/errors";
import type { WorkSettings } from "../types";
export const defaultSettings: WorkSettings = {
  officialEntry: "07:00",
  officialExit: "16:00",
  normalMinutes: 480,
  toleranceMinutes: 10,
  overtimeRule: "after-normal",
  timeZone: "America/Managua",
};
export function Settings() {
  const { settings, error: loadError } = useWorkday();
  const [form, setForm] = useState<WorkSettings>(defaultSettings);
  const [baseline, setBaseline] = useState<WorkSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!dirty) {
      setForm(settings ?? defaultSettings);
      setBaseline(settings);
    }
  }, [settings, dirty]);
  const change = (patch: Partial<WorkSettings>) => {
    setDirty(true);
    setSuccess("");
    setForm({ ...form, ...patch });
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/settings/set", { settings: form, baseline });
      setBaseline(form);
      setSuccess("Configuración guardada. Se aplicará a las nuevas jornadas.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Configuración de jornada</h1>
          <p>Define el horario y las reglas del área.</p>
        </div>
        <SlidersHorizontal size={28} className="heading-icon" />
      </div>
      <form className="panel settings-panel" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <h2>Horario del personal</h2>
            <p>Zona horaria: Nicaragua · America/Managua</p>
          </div>
        </div>
        <div className="settings-body">
          <div className="form-grid">
            <label>
              Hora oficial de entrada
              <input
                type="time"
                value={form.officialEntry}
                onChange={(e) => change({ officialEntry: e.target.value })}
                required
              />
            </label>
            <label>
              Hora oficial de salida
              <input
                type="time"
                value={form.officialExit}
                onChange={(e) => change({ officialExit: e.target.value })}
                required
              />
            </label>
            <label>
              Jornada normal (minutos)
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                value={form.normalMinutes}
                onChange={(e) =>
                  change({ normalMinutes: Number(e.target.value) })
                }
                required
              />
            </label>
            <label>
              Tolerancia de llegada (minutos)
              <input
                type="number"
                min="0"
                max="120"
                step="1"
                value={form.toleranceMinutes}
                onChange={(e) =>
                  change({ toleranceMinutes: Number(e.target.value) })
                }
                required
              />
            </label>
          </div>
          <div className="rule-card">
            <h3>Regla de horas extra</h3>
            <p>El tiempo que exceda la jornada normal cuenta como extra.</p>
            <code>extra = máximo(0, trabajado − jornada normal)</code>
            <p className="footnote">
              Se cuentan minutos completos por jornada, sin descontar descansos.
              El horario y la tolerancia son referencias; no cambian las
              marcaciones ni descuentan tiempo. Los cambios se aplican solo a
              nuevas entradas.
            </p>
          </div>
          {(error || loadError) && (
            <div className="notice error" role="alert">
              {error || loadError}
            </div>
          )}
          {success && (
            <div className="notice success" role="status">
              {success}
            </div>
          )}
          <button className="primary" disabled={busy}>
            <Save size={18} />
            {busy ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>
    </>
  );
}
