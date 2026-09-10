import { describe, it, expect } from "vitest";
import { manualTimes } from "../shared/manual.mjs";
const input = {
  day: "2026-09-01",
  entry: "07:00",
  exit: "16:00",
  nextDay: false,
};
const now = Date.parse("2026-09-08T20:00:00Z");
describe("Horarios declarados en Nicaragua", () => {
  it("admite jornadas anteriores y cruces de medianoche explícitos", () => {
    expect(manualTimes(input, now)).toEqual({
      date: Date.parse("2026-09-01T06:00Z"),
      entryTime: Date.parse("2026-09-01T13:00Z"),
      exitTime: Date.parse("2026-09-01T22:00Z"),
    });
    const night = manualTimes(
      { ...input, entry: "22:00", exit: "06:00", nextDay: true },
      now,
    );
    expect(night.exitTime - night.entryTime).toBe(8 * 3600000);
  });
  it("rechaza futuro, fechas inexistentes, salida anterior y más de 24 horas", () => {
    for (const patch of [
      { day: "2026-09-09" },
      { day: "2026-02-30" },
      { exit: "06:00" },
      { exit: "07:00" },
      { entry: "25:00" },
      { nextDay: true },
      { day: "1999-12-31" },
    ])
      expect(() => manualTimes({ ...input, ...patch }, now)).toThrow();
    expect(() =>
      manualTimes({ ...input, day: "2026-09-08", exit: "15:00" }, now),
    ).toThrow("futuras");
  });
});
