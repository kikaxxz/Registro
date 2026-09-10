import type { Timestamp } from "firebase/firestore";
export interface Profile {
  mustChangePassword?: boolean;
  canRegister?: boolean;
  username?: string;
  uid: string;
  nombre: string;
  correo: string;
  rol: "trabajador" | "jefe";
  activo: boolean;
}
export interface WorkSettings {
  officialEntry: string;
  officialExit: string;
  normalMinutes: number;
  toleranceMinutes: number;
  overtimeRule: "after-normal";
  timeZone: "America/Managua";
}
export interface Attendance {
  source?: "manual";
  submittedAt?: Timestamp;
  id: string;
  employeeId: string;
  employeeName: string;
  date: Timestamp;
  entryTime: Timestamp;
  exitTime: Timestamp | null;
  status: "open" | "closed";
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  policy: WorkSettings;
}
export interface ActiveShift {
  attendanceId: string;
  employeeId: string;
  entryTime: Timestamp;
}
