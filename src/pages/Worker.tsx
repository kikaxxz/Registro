import { useState, type FormEvent } from "react";
import { CalendarDays, Save } from "lucide-react";
import type { Profile } from "../types";
import { saveManualAttendance } from "../services/attendance";
import { dayKey, dayStart, formatDay } from "../utils/time";
import { errorMessage } from "../utils/errors";

export function Worker({ profile }: { profile: Profile }) {
  const [day, setDay] = useState(dayKey());
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await saveManualAttendance(profile, { day, entry, exit, nextDay });
      setSuccess(
        `Jornada del ${formatDay(dayStart(day))} guardada. Disponible en Historial.`,
      );
      setEntry("");
      setExit("");
      setNextDay(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TU JORNADA</span>
          <h1>Registro de horario</h1>
          <p>
            Escribe tu entrada y salida. También puedes registrar un día
            anterior.
          </p>
        </div>
        <CalendarDays className="heading-icon" size={29} />
      </div>
      <form className="panel manual-form" onSubmit={submit}>
        <div className="panel-heading">
          <div>
            <h2>Nueva jornada</h2>
            <p>{profile.nombre} · Hora de Nicaragua</p>
          </div>
        </div>
        <fieldset disabled={busy}>
          <label>
            Fecha de entrada
            <input
              required
              type="date"
              min="2000-01-01"
              max={dayKey()}
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setSuccess("");
              }}
            />
          </label>
          <div className="manual-times">
            <label>
              Hora de entrada
              <input
                required
                type="time"
                step="60"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
            </label>
            <label>
              Hora de salida
              <input
                required
                type="time"
                step="60"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
              />
            </label>
          </div>
          <label className="manual-checkbox">
            <input
              type="checkbox"
              checked={nextDay}
              onChange={(e) => setNextDay(e.target.checked)}
            />
            La salida fue al día siguiente
          </label>
          <p className="muted">
            Una jornada por fecha, de hasta 24 horas. Guarda cuando hayas
            terminado; revisa las horas antes de confirmar.
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="notice success" role="status">
              {success}
            </div>
          )}
          <button className="primary" type="submit">
            <Save size={18} />
            {busy ? "Guardando…" : "Guardar jornada"}
          </button>
        </fieldset>
        <p className="footnote">
          Se conservará la fecha y hora real de guardado junto al horario que
          indiques. Si necesitas corregir la entrada o salida posteriormente,
          puedes hacerlo desde Historial.
        </p>
      </form>
    </section>
  );
}
