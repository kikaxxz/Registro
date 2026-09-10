import { Clock3, Timer, TrendingUp } from "lucide-react";
import { minutesLabel } from "../utils/time";
export function Stats({
  total,
}: {
  total: {
    workedMinutes: number;
    normalMinutes: number;
    overtimeMinutes: number;
  };
}) {
  return (
    <div className="stats-grid">
      {[
        {
          label: "Horas trabajadas",
          value: total.workedMinutes,
          icon: Clock3,
          note: "Jornadas finalizadas",
        },
        {
          label: "Horas normales",
          value: total.normalMinutes,
          icon: Timer,
          note: "Dentro de la jornada",
        },
        {
          label: "Horas extra",
          value: total.overtimeMinutes,
          icon: TrendingUp,
          note: "Sobre la jornada normal",
        },
      ].map(({ label, value, icon: Icon, note }) => (
        <article className="stat-card" key={label}>
          <div className="stat-label">
            {label}
            <Icon size={18} />
          </div>
          <strong>{minutesLabel(value)}</strong>
          <span>{note}</span>
        </article>
      ))}
    </div>
  );
}
