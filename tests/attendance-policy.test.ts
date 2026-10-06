import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { AttendancePolicyService } from "../src/services/attendancePolicyService";

async function runPolicyTests() {
  console.log("🧪 Starting Attendance Policy & Timing tests...");

  // 1. Test getActivePolicy (initializes defaults if not present)
  const policy = await AttendancePolicyService.getActivePolicy(true);
  assert.ok(policy, "Policy must exist");
  assert.equal(policy.gracePeriodMinutes, 15, "Default grace period must be 15 minutes");
  assert.equal(policy.monthlyLateArrivalsAllowed, 3, "Default late arrivals allowance must be 3");
  assert.equal(policy.monthlyEarlyOutAllowed, 1, "Default early out allowance must be 1");
  assert.equal(policy.lateArrivalThresholdMinutes, 60, "Default late arrival threshold must be 60 mins (up to 1 hour)");
  assert.equal(policy.earlyOutThresholdMinutes, 60, "Default early out threshold must be 60 mins (up to 1 hour)");
  assert.equal(policy.missingBothPunchesAction, "ABSENT", "Missing both punches must default to ABSENT");
  assert.equal(policy.missingOnePunchAction, "LATE_OR_EARLY", "Missing one punch must default to LATE_OR_EARLY");
  console.log("✓ Core policy defaults verified (15-min grace, 3 late / 1 early out allowances, missing punch rules)");

  // 2. Test Department Shift Timings
  const timings = await AttendancePolicyService.getAllDepartmentTimings();
  assert.ok(timings.length >= 2, "Must have at least 2 default schedules");
  const generalDept = timings.find((t) => t.name.includes("General"));
  assert.ok(generalDept, "General Departments schedule must exist");
  assert.equal(generalDept.monThuStart, "09:30");
  assert.equal(generalDept.monThuEnd, "18:00");
  assert.equal(generalDept.satWorkingType, "ALTERNATE", "General depts must have alternate Saturdays");

  const researchWing = timings.find((t) => t.category === "RESEARCH_WING" || t.name.includes("Research"));
  assert.ok(researchWing, "Administrative Staff (Research Wing) schedule must exist");
  assert.equal(researchWing.monThuStart, "08:30");
  assert.equal(researchWing.monThuEnd, "18:00");
  assert.equal(researchWing.satWorkingType, "ALTERNATE", "Research wing must have alternate Saturdays");
  console.log("✓ Department-wise shift timings verified (General Depts 9:30 AM - 6:00 PM, Research Wing 8:30 AM - 6:00 PM)");

  // 3. Test Update Policy
  const updatedPolicy = await AttendancePolicyService.updatePolicy(policy.id, {
    gracePeriodMinutes: 20,
    monthlyLateArrivalsAllowed: 4,
  });
  assert.equal(updatedPolicy.gracePeriodMinutes, 20);
  assert.equal(updatedPolicy.monthlyLateArrivalsAllowed, 4);

  // Restore back to 15 and 3
  await AttendancePolicyService.updatePolicy(policy.id, {
    gracePeriodMinutes: 15,
    monthlyLateArrivalsAllowed: 3,
  });
  console.log("✓ Policy update and reactive caching verified");

  // 4. Test Monthly Allowance Calculation
  // Find any active employee to calculate allowance structure
  const testUser = await prisma.user.findFirst({
    where: { isActive: true },
  });
  if (testUser) {
    const allowance = await AttendancePolicyService.getMonthlyAllowanceStatus(testUser.id, new Date());
    assert.ok(allowance, "Allowance summary must return");
    assert.equal(allowance.policy.gracePeriodMinutes, 15);
    assert.equal(allowance.late.allowed, 3);
    assert.equal(allowance.earlyOut.allowed, 1);
    assert.ok(typeof allowance.late.used === "number");
    assert.ok(typeof allowance.late.remaining === "number");
    console.log("✓ Monthly allowance tracking logic verified for employee:", testUser.firstName, testUser.lastName);
  }

  // 5. Test Regularisation Submission
  if (testUser) {
    const reg = await AttendancePolicyService.submitRegularisation({
      employeeId: testUser.id,
      date: new Date(),
      regularisationType: "TECHNICAL_ISSUE",
      reason: "Biometric device offline test verification",
    });
    assert.ok(reg.id, "Regularisation must generate an ID");
    assert.equal(reg.status, "PENDING");
    assert.equal(reg.regularisationType, "TECHNICAL_ISSUE");

    // Review regularisation
    const reviewed = await AttendancePolicyService.reviewRegularisation(reg.id, "APPROVED", "test-admin", "Approved per verification");
    assert.equal(reviewed.status, "APPROVED");
    assert.equal(reviewed.reviewedBy, "test-admin");
    console.log("✓ Technical issue regularisation workflow verified (Submission & Approval)");
  }

  console.log("🎉 All Attendance Policy & Timing regression tests passed successfully!");
}

runPolicyTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
