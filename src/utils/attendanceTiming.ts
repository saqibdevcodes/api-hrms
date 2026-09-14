const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Attendance stores PKT wall-clock values in UTC fields; shifts store real UTC
 * instants. Put the shift's PKT clock time on the stored attendance date before
 * comparing them. UTC accessors keep this independent of the server timezone.
 */
export function shiftTimeOnAttendanceDate(
  attendanceDate: Date | string,
  shiftTime: Date | string,
): Date {
  const date = new Date(attendanceDate);
  const clock = new Date(new Date(shiftTime).getTime() + PKT_OFFSET_MS);
  date.setUTCHours(clock.getUTCHours(), clock.getUTCMinutes(), clock.getUTCSeconds(), 0);
  return date;
}

export function secondsAfter(actual: Date | string, cutoff: Date | string): number {
  return Math.max(0, Math.floor((new Date(actual).getTime() - new Date(cutoff).getTime()) / 1000));
}

export function formatAttendanceDuration(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  return `${Math.floor(seconds / 60)} M ${seconds % 60} S`;
}
