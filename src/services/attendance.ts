import { Timestamp } from "firebase/firestore";
import type { Attendance, Profile } from "../types";
import { api } from "./api";
import { manualTimes, type ManualInput } from "../../shared/manual.mjs";
export async function saveManualAttendance(
  _profile: Profile,
  input: ManualInput,
) {
  manualTimes(input);
  await api("/attendance/save", input);
}
export interface RecordFilter {
  from: string;
  to: string;
  employeeId?: string;
}
export async function fetchAttendance(
  filter: RecordFilter,
): Promise<Attendance[]> {
  const data = await api<{ records: Array<Record<string, unknown>> }>(
    "/attendance/list",
    filter,
  );
  return data.records.map(
    (r) =>
      ({
        ...r,
        date: Timestamp.fromDate(new Date(r.date as string)),
        entryTime: Timestamp.fromDate(new Date(r.entryTime as string)),
        exitTime: r.exitTime
          ? Timestamp.fromDate(new Date(r.exitTime as string))
          : null,
        ...(r.submittedAt
          ? {
              submittedAt: Timestamp.fromDate(
                new Date(r.submittedAt as string),
              ),
            }
          : {}),
      }) as Attendance,
  );
}
