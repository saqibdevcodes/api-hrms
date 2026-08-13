const MIN_TIMEZONE_OFFSET_MINUTES = -12 * 60;
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

const pad = (value: number): string => String(value).padStart(2, "0");

export const validateZKTecoTimezoneOffset = (offsetMinutes: number): void => {
  if (
    !Number.isInteger(offsetMinutes) ||
    offsetMinutes < MIN_TIMEZONE_OFFSET_MINUTES ||
    offsetMinutes > MAX_TIMEZONE_OFFSET_MINUTES
  ) {
    throw new Error(
      "ZKTECO_TIMEZONE_OFFSET_MINUTES must be an integer between -720 and 840",
    );
  }
};

/**
 * Older ZKTeco PUSH terminals represent whole-hour zones as hours, while
 * fractional zones are represented as minutes (Pakistan is 5; India is 330).
 */
export const formatZKTecoTimezone = (offsetMinutes: number): string => {
  validateZKTecoTimezoneOffset(offsetMinutes);

  return offsetMinutes % 60 === 0
    ? String(offsetMinutes / 60)
    : String(offsetMinutes);
};

const formatIsoOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(
    absoluteMinutes % 60,
  )}`;
};

/**
 * Formats an instant as a ZKTeco local wall-clock value with an explicit
 * offset. UTC getters are intentional after shifting by the configured zone.
 */
export const formatZKTecoDeviceTime = (
  date: Date,
  offsetMinutes: number,
): string => {
  validateZKTecoTimezoneOffset(offsetMinutes);

  const shiftedDate = new Date(date.getTime() + offsetMinutes * 60_000);
  const localDateTime = [
    shiftedDate.getUTCFullYear(),
    "-",
    pad(shiftedDate.getUTCMonth() + 1),
    "-",
    pad(shiftedDate.getUTCDate()),
    "T",
    pad(shiftedDate.getUTCHours()),
    ":",
    pad(shiftedDate.getUTCMinutes()),
    ":",
    pad(shiftedDate.getUTCSeconds()),
  ].join("");

  return `${localDateTime}${formatIsoOffset(offsetMinutes)}`;
};

export const buildZKTecoOptionsResponse = (
  serialNumber: string,
  offsetMinutes: number,
): string => {
  if (!serialNumber) {
    throw new Error("ZKTeco serial number is required");
  }

  return [
    `GET OPTION FROM: ${serialNumber}`,
    "ErrorDelay=60",
    "Delay=10",
    "TransTimes=00:00",
    "TransInterval=1",
    "TransFlag=1111000000",
    `TimeZone=${formatZKTecoTimezone(offsetMinutes)}`,
    "Realtime=1",
    "Encrypt=0",
    "ServerVer=2.2.14",
    "PushProtVer=2.4.2",
  ].join("\n");
};

