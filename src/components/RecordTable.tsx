import { ClipboardList } from "lucide-react";
import type { Attendance } from "../types";
import { formatDay, formatTime, minutesLabel, totalsOf } from "../utils/time";
export function RecordTable({
  records,
  showEmployee = false,
}: {
  records: Attendance[];
  showEmployee?: boolean;
}) {
  if (!records.length)
    return (
      <div className="empty">
        <ClipboardList size={30} />
        <h3>No hay registros en este período</h3>
        <p>Las jornadas aparecerán aquí después de guardarlas en Registro.</p>
      </div>
    );
  return (
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
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const total = totalsOf(record);
            return (
              <tr key={record.id}>
                {showEmployee && (
                  <td className="employee-cell">{record.employeeName}</td>
                )}
                <td>{formatDay(record.entryTime.toDate())}</td>
                <td className="mono">
                  {formatTime(record.entryTime.toDate())}
                </td>
                <td className="mono">
                  {record.exitTime ? (
                    <>
                      {formatTime(record.exitTime.toDate())}
                      {record.exitTime.toDate().getTime() -
                        record.entryTime.toDate().getTime() >
                        0 &&
                        formatDay(record.entryTime.toDate()) !==
                          formatDay(record.exitTime.toDate()) && (
                          <small>{formatDay(record.exitTime.toDate())}</small>
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
                <td className={total.overtimeMinutes ? "extra-text" : "muted"}>
                  {record.exitTime ? minutesLabel(total.overtimeMinutes) : "—"}
                </td>
                <td>
                  <span
                    className={`badge ${record.status === "open" ? "working" : ""}`}
                  >
                    <i />
                    {record.status === "open" ? "Sin salida" : "Finalizada"}
                  </span>
                </td>
                <td>
                  {record.source === "manual"
                    ? "Horario declarado"
                    : "Marcación anterior"}
                  {record.submittedAt && (
                    <small>
                      {formatDay(record.submittedAt.toDate())} ·{" "}
                      {formatTime(record.submittedAt.toDate())}
                    </small>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
