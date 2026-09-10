import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, CalendarDays, ArrowRight, FileDown } from "lucide-react";
import type { Attendance, Profile } from "../types";
import { fetchAttendance } from "../services/attendance";
import { currentRange, summarize } from "../utils/time";
import { errorMessage } from "../utils/errors";
import { RecordTable } from "../components/RecordTable";
import { Stats } from "../components/Stats";
import { useHistoryTool } from "../hooks/useHistoryTool";
export function History({
  profile,
  employees = [],
  revision = 0,
  compact = false,
}: {
  profile: Profile;
  employees?: Profile[];
  revision?: number;
  compact?: boolean;
}) {
  const boss = profile.rol === "jefe";
  const [range, setRange] = useState(currentRange("month"));
  const [employeeId, setEmployeeId] = useState("");
  const [records, setRecords] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [loadedRange, setLoadedRange] = useState("");
  const [loadedFilter, setLoadedFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filterKey = JSON.stringify([
    range.from,
    range.to,
    employeeId,
    profile.uid,
  ]);
  async function exportPdf() {
    if (busy || error || loadedFilter !== filterKey) return;
    setExporting(true);
    setExportError("");
    try {
      const { exportAttendancePdf } = await import("../utils/exportPdf");
      exportAttendancePdf(records, {
        ...range,
        showEmployee: boss,
        employee: boss
          ? employeeId
            ? (employees.find((e) => e.uid === employeeId)?.nombre ??
              "Trabajador seleccionado")
            : "Todo el personal"
          : profile.nombre,
      });
    } catch {
      setExportError("No se pudo generar el PDF. Vuelve a intentarlo.");
    } finally {
      setExporting(false);
    }
  }
  const readSummary = useCallback(() => {
    if (busy || error) throw new Error("El resumen aún no está disponible.");
    return {
      period: loadedRange,
      records: records.length,
      ...summarize(records),
    };
  }, [busy, error, loadedRange, records]);
  useHistoryTool(readSummary);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const results = await fetchAttendance({
        ...range,
        employeeId: boss ? employeeId || undefined : profile.uid,
      });
      if (request === requestId.current) {
        setRecords(results);
        setLoadedRange(`${range.from} — ${range.to}`);
        setLoadedFilter(
          JSON.stringify([range.from, range.to, employeeId, profile.uid]),
        );
      }
    } catch (e) {
      if (request === requestId.current) {
        setError(errorMessage(e));
        setRecords([]);
        setLoadedRange("");
      }
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }, [range, employeeId, boss, profile.uid]);
  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [load, revision]);
  return (
    <section className="history-section">
      {!compact && (
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              {boss ? "CONTROL DEL ÁREA" : "TU ACTIVIDAD"}
            </span>
            <h1>{boss ? "Historial del personal" : "Mi historial"}</h1>
            <p>Consulta las jornadas y las horas acumuladas.</p>
          </div>
          <CalendarDays className="heading-icon" size={29} />
        </div>
      )}
      <div className="filters">
        <div className="preset-group" aria-label="Período">
          {(["today", "week", "month"] as const).map((kind, i) => {
            const target = currentRange(kind);
            return (
              <button
                type="button"
                key={kind}
                className={
                  range.from === target.from && range.to === target.to
                    ? "selected"
                    : ""
                }
                onClick={() => setRange(target)}
              >
                {["Hoy", "Esta semana", "Este mes"][i]}
              </button>
            );
          })}
        </div>
        <div className="date-fields">
          <label>
            Desde
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </label>
          <ArrowRight size={16} />
          <label>
            Hasta
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </label>
        </div>
        {boss && (
          <label className="employee-filter">
            Trabajador
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Todo el personal</option>
              {employees.map((e) => (
                <option key={e.uid} value={e.uid}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="icon-button refresh"
          title="Actualizar historial"
          aria-label="Actualizar historial"
          onClick={load}
          disabled={busy}
        >
          <RefreshCw size={18} className={busy ? "spin" : ""} />
        </button>
      </div>
      {exportError && (
        <div className="notice error" role="alert">
          {exportError}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {busy ? (
        <div className="panel loading" role="status">
          Consultando registros…
        </div>
      ) : (
        !error && (
          <>
            <Stats total={summarize(records)} />
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{compact ? "Mis registros" : "Detalle de jornadas"}</h2>
                  <p>
                    {records.length} registros · {loadedRange}
                  </p>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={exportPdf}
                  disabled={busy || exporting || loadedFilter !== filterKey}
                >
                  <FileDown size={18} />
                  {exporting ? "Generando…" : "Exportar PDF"}
                </button>
              </div>
              <RecordTable records={records} showEmployee={boss} />
            </div>
            <p className="footnote">
              Los totales incluyen jornadas finalizadas, agrupadas por el día de
              entrada. Los horarios declarados conservan la regla de horas extra
              vigente al guardarse; las marcaciones anteriores, la vigente al
              iniciarse.
            </p>
          </>
        )
      )}
    </section>
  );
}
