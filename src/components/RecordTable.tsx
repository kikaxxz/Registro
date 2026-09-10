import { useState } from "react";
import {
  ClipboardList,
  Pencil,
  Save,
  X,
} from "lucide-react";

import type { Attendance } from "../types";

import {
  dayKey,
  formatDay,
  formatTime,
  minutesLabel,
  totalsOf,
} from "../utils/time";

import { updateManualAttendance } from "../services/attendance";
import { errorMessage } from "../utils/errors";

export function RecordTable({
  records,
  showEmployee = false,
  onUpdated,
}: {
  records: Attendance[];
  showEmployee?: boolean;
  onUpdated?: () => void | Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function beginEdit(record: Attendance) {
    if (!record.exitTime) return;

    const entryDate = record.entryTime.toDate();
    const exitDate = record.exitTime.toDate();

    setEditingId(record.id);
    setEntry(formatTime(entryDate));
    setExit(formatTime(exitDate));

    setNextDay(
      dayKey(entryDate) !== dayKey(exitDate),
    );

    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEntry("");
    setExit("");
    setNextDay(false);
    setError("");
  }

  async function saveEdit(record: Attendance) {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await updateManualAttendance(record.id, {
        day: dayKey(record.entryTime.toDate()),
        entry,
        exit,
        nextDay,
      });

      cancelEdit();

      await onUpdated?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!records.length) {
    return (
      <div className="empty">
        <ClipboardList size={30} />
        <h3>No hay registros en este período</h3>
        <p>
          Las jornadas aparecerán aquí después de guardarlas en Registro.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          className="notice error"
          role="alert"
          style={{ margin: "0 20px 15px" }}
        >
          {error}
        </div>
      )}

      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Historial de asistencia"
      >
        <table>
          <thead>
            <tr>
              {showEmployee && <th>Trabajador</th>}

              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Trabajado</th>
              <th>Extra</th>
              <th>Estado</th>
              <th>Origen / guardado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => {
              const total = totalsOf(record);
              const editing = editingId === record.id;

              return (
                <tr key={record.id}>
                  {showEmployee && (
                    <td className="employee-cell">
                      {record.employeeName}
                    </td>
                  )}

                  <td>
                    {formatDay(record.entryTime.toDate())}
                  </td>

                  <td className="mono">
                    {editing ? (
                      <input
                        type="time"
                        step="60"
                        value={entry}
                        onChange={(e) =>
                          setEntry(e.target.value)
                        }
                        disabled={busy}
                      />
                    ) : (
                      formatTime(record.entryTime.toDate())
                    )}
                  </td>

                  <td className="mono">
                    {editing ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <input
                          type="time"
                          step="60"
                          value={exit}
                          onChange={(e) =>
                            setExit(e.target.value)
                          }
                          disabled={busy}
                        />

                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: "0.65rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={nextDay}
                            onChange={(e) =>
                              setNextDay(e.target.checked)
                            }
                            disabled={busy}
                          />
                          Día siguiente
                        </label>
                      </div>
                    ) : record.exitTime ? (
                      <>
                        {formatTime(
                          record.exitTime.toDate(),
                        )}

                        {dayKey(record.entryTime.toDate()) !==
                          dayKey(record.exitTime.toDate()) && (
                          <small>
                            {formatDay(
                              record.exitTime.toDate(),
                            )}
                          </small>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>
                    {record.exitTime
                      ? minutesLabel(total.workedMinutes)
                      : "En curso"}
                  </td>

                  <td
                    className={
                      total.overtimeMinutes
                        ? "extra-text"
                        : "muted"
                    }
                  >
                    {record.exitTime
                      ? minutesLabel(total.overtimeMinutes)
                      : "—"}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        record.status === "open"
                          ? "working"
                          : ""
                      }`}
                    >
                      <i />

                      {record.status === "open"
                        ? "Sin salida"
                        : "Finalizada"}
                    </span>
                  </td>

                  <td>
                    {record.source === "manual"
                      ? "Horario declarado"
                      : "Marcación anterior"}

                    {record.submittedAt && (
                      <small>
                        Guardado:{" "}
                        {formatDay(
                          record.submittedAt.toDate(),
                        )}{" "}
                        ·{" "}
                        {formatTime(
                          record.submittedAt.toDate(),
                        )}
                      </small>
                    )}

                    {record.updatedAt && (
                      <small>
                        Editado:{" "}
                        {formatDay(record.updatedAt.toDate())}{" "}
                        ·{" "}
                        {formatTime(record.updatedAt.toDate())}
                      </small>
                    )}
                  </td>

                  <td>
                    {editing ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          className="icon-button"
                          title="Guardar cambios"
                          aria-label="Guardar cambios"
                          disabled={busy}
                          onClick={() =>
                            void saveEdit(record)
                          }
                        >
                          <Save size={16} />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          title="Cancelar"
                          aria-label="Cancelar"
                          disabled={busy}
                          onClick={cancelEdit}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      record.source === "manual" &&
                      record.exitTime && (
                        <button
                          type="button"
                          className="icon-button"
                          title="Editar registro"
                          aria-label="Editar registro"
                          onClick={() =>
                            beginEdit(record)
                          }
                        >
                          <Pencil size={16} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}