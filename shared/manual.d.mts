export interface ManualInput {
  day: string;
  entry: string;
  exit: string;
  nextDay: boolean;
}
export function manualTimes(
  input: ManualInput,
  now?: number,
): { date: number; entryTime: number; exitTime: number };
export function manualId(uid: string, date: number): string;
