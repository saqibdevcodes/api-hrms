import assert from "node:assert/strict";
import { formatAttendanceDuration, secondsAfter, shiftTimeOnAttendanceDate } from "../src/utils/attendanceTiming";

// Stored punches contain PKT wall-clock values; shift times are real UTC.
const shift = {
  startTime: new Date("2026-01-01T04:45:00Z"),
  endTime: new Date("2026-01-01T13:00:00Z"),
  halfDayStart: null,
};
const stored: any = {
  id: "attendance-test",
  date: new Date("2026-09-14T00:00:00Z"),
  checkIn: new Date("2026-09-14T10:13:00Z"),
  checkOut: null,
  employee: { id: "employee-test", firstName: "Test", lastName: "Employee", email: "test@example.com", shift, companyMemberships: [] },
  zktecoRecords: [],
};
let sentHtml = "";
const stubs: Record<string, unknown> = {
  "src/lib/prisma.ts": { prisma: {
    attendance: { findUnique: async () => stored, findMany: async () => [stored] },
    department: { findMany: async () => [] },
  } },
  "src/services/zktecoService.ts": { zktecoService: {} },
  "src/utils/emailService.ts": { EmailService: { sendEmail: async (_to: string, _subject: string, html: string) => { sentHtml = html; } } },
  "src/queues/email.jobs.ts": {},
  "src/services/emailQueueService.ts": {},
};
const Module = require("module") as any;
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  const resolved = Module._resolveFilename(request, parent).replace(/\\/g, "/");
  const key = Object.keys(stubs).find((suffix) => resolved.endsWith(suffix));
  return key ? stubs[key] : originalLoad.call(this, request, parent, isMain);
};
const { ZKTecoController } = require("../src/controller/zktecoController");
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

async function main() {
  const originalTZ = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Karachi", "America/New_York"]) {
      process.env.TZ = timezone;
      const cutoff = shiftTimeOnAttendanceDate(stored.date, shift.startTime);
      assert.equal(cutoff.toISOString(), "2026-09-14T09:45:00.000Z");
      assert.equal(secondsAfter("2026-09-14T09:44:59Z", cutoff), 0);
      assert.equal(secondsAfter("2026-09-14T09:45:00Z", cutoff), 0);
      assert.equal(formatAttendanceDuration(secondsAfter("2026-09-14T09:45:01Z", cutoff)), "0 M 1 S");

      for (const [time, seconds, formatted] of [
        ["10:13:00", 1680, "28 M 0 S"],
        ["10:13:42", 1722, "28 M 42 S"],
      ] as const) {
        stored.checkIn = new Date(`2026-09-14T${time}Z`);
        const list = response();
        await ZKTecoController.getAttendanceData({
          query: { startDate: "2026-09-14", endDate: "2026-09-14" },
          user: { id: "hr-test", role: "HR", email: "hr@example.com" },
        }, list);
        assert.equal(list.statusCode, 200);
        assert.equal(list.body.data.records[0].lateMinutes, 28);
        assert.equal(list.body.data.records[0].lateSeconds, seconds);

        const result = response();
        await ZKTecoController.requestReason({ body: { record: {
          id: stored.id, date: "9/14/2026", checkIn: `${time} AM`,
          checkInStatus: "LATE", lateMinutes: 328,
          employee: { email: "test@example.com" },
        } } }, result);
        assert.equal(result.statusCode, 200);
        assert.ok(sentHtml.includes(`late by ${formatted}`), sentHtml);
        assert.ok(!sentHtml.includes("328"));
        assert.ok(sentHtml.includes("No check-out recorded"));
      }
    }
    assert.equal(formatAttendanceDuration(3659), "60 M 59 S");
    assert.equal(formatAttendanceDuration(-1), "0 M 0 S");
    console.log("Attendance timing and reason email regressions passed in 3 server timezones.");
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
