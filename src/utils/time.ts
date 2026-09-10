import type { Attendance } from "../types";

export const ZONE = "America/Managua";

export function dayKey(date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}

export function dayStart(day: string) {
  return new Date(`${day}T00:00:00-06:00`);
}

export function nextDay(day: string) {
  return new Date(dayStart(day).getTime() + 86400000);
}

export function shiftDay(day: string, amount: number) {
  return dayKey(new Date(dayStart(day).getTime() + amount * 86400000));
}

export function currentRange(
  kind: "week" | "month" | "today",
  now = new Date(),
) {
  const to = dayKey(now);
  const weekDay = new Date(`${to}T12:00:00Z`).getUTCDay();

  return {
    from:
      kind === "month"
        ? `${to.slice(0, 7)}-01`
        : kind === "week"
          ? shiftDay(to, -((weekDay + 6) % 7))
          : to,
    to,
  };
}

export function formatTime(date: Date | undefined | null) {
  return date
    ? new Intl.DateTimeFormat("es-NI", {
        timeZone: ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date)
    : "—";
}

export function formatDay(date: Date) {
  return new Intl.DateTimeFormat("es-NI", {
    timeZone: ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function minutesLabel(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/**
 * Calcula cuánto tiempo de la jornada coincide con el almuerzo 12:00–13:00.
 * Se contemplan jornadas que terminan al día siguiente.
 */
export function lunchMinutesBetween(entry: number, exit: number) {
  if (exit <= entry) return 0;

  const firstDay = dayKey(new Date(entry));
  let lunchMinutes = 0;

  // Una jornada puede durar como máximo 24 horas,
  // por lo que solo puede tocar el día inicial y el siguiente.
  for (let offset = 0; offset <= 1; offset++) {
    const day = shiftDay(firstDay, offset);
    const lunchStart = dayStart(day).getTime() + 12 * 60 * 60 * 1000;
    const lunchEnd = lunchStart + 60 * 60 * 1000;

    const overlapStart = Math.max(entry, lunchStart);
    const overlapEnd = Math.min(exit, lunchEnd);

    if (overlapEnd > overlapStart) {
      lunchMinutes += Math.floor((overlapEnd - overlapStart) / 60000);
    }
  }

  return lunchMinutes;
}

export function calculateMinutes(entry: number, exit: number, normal: number) {
  const grossMinutes = Math.max(0, Math.floor((exit - entry) / 60000));
  const lunchMinutes = lunchMinutesBetween(entry, exit);

  const workedMinutes = Math.max(0, grossMinutes - lunchMinutes);
  const overtimeMinutes = Math.max(0, workedMinutes - normal);

  return {
    workedMinutes,
    overtimeMinutes,
    normalMinutes: workedMinutes - overtimeMinutes,
  };
}

export function totalsOf(record: Attendance) {
  return record.exitTime
    ? calculateMinutes(
        Math.floor(record.entryTime.toMillis()),
        Math.floor(record.exitTime.toMillis()),
        record.policy.normalMinutes,
      )
    : {
        workedMinutes: 0,
        overtimeMinutes: 0,
        normalMinutes: 0,
      };
}

export function summarize(records: Attendance[]) {
  return records.reduce(
    (total, record) => {
      const next = totalsOf(record);

      return {
        workedMinutes: total.workedMinutes + next.workedMinutes,
        normalMinutes: total.normalMinutes + next.normalMinutes,
        overtimeMinutes: total.overtimeMinutes + next.overtimeMinutes,
      };
    },
    {
      workedMinutes: 0,
      normalMinutes: 0,
      overtimeMinutes: 0,
    },
  );
}