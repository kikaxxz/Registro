import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  calculateMinutes,
  currentRange,
  dayKey,
  dayStart,
  nextDay,
  summarize,
} from "../src/utils/time";
import type { Attendance } from "../src/types";
describe("Cálculos de asistencia", () => {
  it("calcula minutos completos y extras", () => {
    expect(calculateMinutes(0, (540 * 60 + 59) * 1000, 480)).toEqual({
      workedMinutes: 540,
      normalMinutes: 480,
      overtimeMinutes: 60,
    });
    expect(calculateMinutes(0, 120 * 60000, 480).overtimeMinutes).toBe(0);
  });
  it("maneja medianoche y duraciones negativas", () => {
    expect(
      calculateMinutes(
        Date.parse("2026-09-07T22:00:00-06:00"),
        Date.parse("2026-09-08T07:00:00-06:00"),
        480,
      ).overtimeMinutes,
    ).toBe(60);
    expect(calculateMinutes(1000, 0, 480).workedMinutes).toBe(0);
  });
  it("usa el día de Nicaragua independientemente de la zona del dispositivo", () => {
    expect(dayKey(new Date("2026-09-08T03:00:00Z"))).toBe("2026-09-07");
    expect(dayStart("2026-09-07").toISOString()).toBe(
      "2026-09-07T06:00:00.000Z",
    );
    expect(nextDay("2026-12-31").toISOString()).toBe(
      "2027-01-01T06:00:00.000Z",
    );
  });
  it("la semana empieza en lunes, incluyendo domingos y cruces de año", () => {
    expect(currentRange("week", new Date("2026-09-13T18:00:00Z"))).toEqual({
      from: "2026-09-07",
      to: "2026-09-13",
    });
    expect(currentRange("week", new Date("2027-01-01T18:00:00Z")).from).toBe(
      "2026-12-28",
    );
  });
  it("deriva totales de timestamps y no de cachés manipuladas; excluye jornadas abiertas", () => {
    const record = {
      entryTime: Timestamp.fromMillis(0),
      exitTime: Timestamp.fromMillis(540 * 60000),
      policy: { normalMinutes: 480 },
      workedMinutes: 99999,
    } as Attendance;
    expect(summarize([record, { ...record, exitTime: null }])).toEqual({
      workedMinutes: 540,
      overtimeMinutes: 60,
      normalMinutes: 480,
    });
  });
});
