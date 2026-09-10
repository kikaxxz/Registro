// Nicaragua business time is UTC-06:00. Never use the browser's local timezone.
export function manualTimes(input, now = Date.now()) {
  const { day, entry, exit, nextDay } = input ?? {};
  const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  if (
    typeof day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    day < "2000-01-01" ||
    !timePattern.test(entry) ||
    !timePattern.test(exit) ||
    typeof nextDay !== "boolean"
  )
    throw new Error("Completa una fecha válida y ambas horas.");
  const date = Date.parse(`${day}T00:00:00-06:00`);
  if (
    !Number.isFinite(date) ||
    new Date(date - 21600000).toISOString().slice(0, 10) !== day
  )
    throw new Error("La fecha no existe.");
  const entryTime = Date.parse(`${day}T${entry}:00-06:00`);
  const exitTime =
    Date.parse(`${day}T${exit}:00-06:00`) + (nextDay ? 86400000 : 0);
  if (exitTime <= entryTime)
    throw new Error(
      "La salida debe ser posterior a la entrada. Si saliste al día siguiente, marca esa opción.",
    );
  if (exitTime - entryTime > 86400000)
    throw new Error("La jornada no puede superar 24 horas.");
  if (exitTime > now)
    throw new Error(
      "No se pueden guardar horas futuras. Registra la jornada después de terminarla.",
    );
  return { date, entryTime, exitTime };
}
export const manualId = (uid, date) => `${uid}_manual_${date}`;
