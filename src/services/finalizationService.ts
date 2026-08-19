/**
 * Finalization Service
 *
 * Finalizes validated staging records into the live attendance tables.
 *
 * Flow:
 * 1. Device punches -> ZKTecoAttendanceStaging (immediate)
 * 2. Immediately -> ZKTecoAttendanceRecord (finalized)
 * 3. Immediately -> Attendance table (visible in HRMS)
 */

import { prisma } from "../lib/prisma";

const finalizationDebug = (...args: unknown[]): void => {
  if (process.env.ZKTECO_VERBOSE_LOGS === "true") {
    console.log(...args);
  }
};

export class FinalizationService {
  /**
   * Retry any records that were not finalized during real-time processing.
   */
  public async finalizeStagingRecords(): Promise<{
    success: boolean;
    finalized: number;
    errors: number;
  }> {
    try {
      finalizationDebug("🔄 Starting finalization retry process...");

      const stagingRecords = await prisma.zKTecoAttendanceStaging.findMany({
        where: {
          isFinalized: false,
          userId: { not: null },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      finalizationDebug(
        `📊 Found ${stagingRecords.length} staging records to finalize`,
      );

      let finalizedCount = 0;
      let errorCount = 0;

      for (const stagingRecord of stagingRecords) {
        try {
          await this.finalizeSingleRecord(stagingRecord);
          finalizedCount++;
        } catch (error) {
          console.error(
            `❌ Error finalizing record ${stagingRecord.id}:`,
            error,
          );
          errorCount++;
        }
      }

      finalizationDebug(
        `✅ Finalization complete: ${finalizedCount} finalized, ${errorCount} errors`,
      );

      return {
        success: true,
        finalized: finalizedCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error("❌ Error in finalization process:", error);
      return {
        success: false,
        finalized: 0,
        errors: 0,
      };
    }
  }

  /**
   * Finalize a single staging record
   */
  private async finalizeSingleRecord(stagingRecord: any): Promise<any | null> {
    finalizationDebug(`🔄 Finalizing record ${stagingRecord.id}...`);

    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
    const pktNow = () => new Date(Date.now() + PKT_OFFSET_MS);
    let finalizedAttendance: any = null;

    // Reuse an existing final record if an earlier attempt only partially
    // completed. This makes the real-time retry path idempotent.
    let finalRecord = await prisma.zKTecoAttendanceRecord.findFirst({
      where: { finalizedFrom: stagingRecord.id },
    });

    if (!finalRecord) {
      finalRecord = await prisma.zKTecoAttendanceRecord.create({
        data: {
          employeeId: stagingRecord.employeeId,
          deviceId: stagingRecord.deviceId,
          timestamp: stagingRecord.timestamp,
          checkType: stagingRecord.checkType,
          verifyType: stagingRecord.verifyType,
          workCode: stagingRecord.workCode,
          overallStatus: stagingRecord.overallStatus,
          processed: false,
          processingError: stagingRecord.processingError,
          userId: stagingRecord.userId,
          finalizedFrom: stagingRecord.id,
          finalizedAt: pktNow(),
        },
      });
    }

    finalizationDebug(`✅ Final record ready: ${finalRecord.id}`);

    // Step 2: Create or update attendance record
    finalizationDebug(`🔍 Checking attendance creation conditions:`);
    finalizationDebug(`   userId: ${stagingRecord.userId}`);
    finalizationDebug(`   processingError: ${stagingRecord.processingError}`);

    // Skip only if there's a real error (not just tracking notes)
    const isRealError =
      stagingRecord.processingError &&
      !stagingRecord.processingError.includes("(deduction in final table)") &&
      !stagingRecord.processingError.includes("(will apply in final table)");

    if (stagingRecord.userId && !isRealError) {
      finalizationDebug(`✅ Conditions met, finding employee...`);
      const employee = await prisma.user.findUnique({
        where: { id: stagingRecord.userId },
        include: { shift: true },
      });

      finalizationDebug(`   Employee found: ${employee ? "Yes" : "No"}`);
      if (employee) {
        finalizationDebug(
          `   Employee: ${employee.firstName} ${employee.lastName} (${employee.id})`,
        );
        const attendanceDate = new Date(stagingRecord.timestamp);
        const dateOnly = new Date(
          Date.UTC(
            attendanceDate.getUTCFullYear(),
            attendanceDate.getUTCMonth(),
            attendanceDate.getUTCDate(),
          ),
        );

        let attendance = await prisma.attendance.findFirst({
          where: {
            employeeId: employee.id,
            date: dateOnly,
          },
        });

        if (!attendance) {
          // Create new attendance record
          attendance = await prisma.attendance.create({
            data: {
              employeeId: employee.id,
              date: dateOnly,
              checkIn:
                stagingRecord.checkType === "check_in"
                  ? stagingRecord.timestamp
                  : null,
              checkOut:
                stagingRecord.checkType === "check_out"
                  ? stagingRecord.timestamp
                  : null,
              status: "PRESENT",
              deviceCheckIns: stagingRecord.checkType === "check_in" ? 1 : 0,
              deviceCheckOuts: stagingRecord.checkType === "check_out" ? 1 : 0,
              lastDeviceSync: pktNow(),
              notes: `Finalized from staging record ${stagingRecord.id}`,
            },
          });

          finalizationDebug(`✅ Created attendance record: ${attendance.id}`);
        } else {
          // Update existing attendance record
          const updateData: any = {
            status: "PRESENT",
            lastDeviceSync: pktNow(),
          };

          if (stagingRecord.checkType === "check_in" && !attendance.checkIn) {
            updateData.checkIn = stagingRecord.timestamp;
            updateData.deviceCheckIns = (attendance.deviceCheckIns || 0) + 1;
          } else if (stagingRecord.checkType === "check_out") {
            updateData.checkOut = stagingRecord.timestamp;
            updateData.deviceCheckOuts = (attendance.deviceCheckOuts || 0) + 1;

            if (attendance.checkIn) {
              const workingMs =
                stagingRecord.timestamp.getTime() -
                attendance.checkIn.getTime();
              const workingHours = workingMs / (1000 * 60 * 60);
              updateData.totalHours = Math.round(workingHours * 100) / 100;
            }
          }

          attendance = await prisma.attendance.update({
            where: { id: attendance.id },
            data: updateData,
          });

          finalizationDebug(`✅ Updated attendance record: ${attendance.id}`);
        }

        finalizedAttendance = attendance;

        // Link final record to attendance
        await prisma.zKTecoAttendanceRecord.update({
          where: { id: finalRecord.id },
          data: {
            attendanceId: attendance.id,
            processed: true,
          },
        });
      }
    }

    // Step 3: Mark staging record as finalized
    await prisma.zKTecoAttendanceStaging.update({
      where: { id: stagingRecord.id },
      data: {
        isFinalized: true,
        finalizedAt: pktNow(),
        updatedAt: pktNow(),
      },
    });

    finalizationDebug(`✅ Marked staging record as finalized`);
    return finalizedAttendance;
  }

  /**
   * Finalize one valid punch immediately so it is visible in the HRMS.
   */
  public async finalizeStagingRecordImmediately(
    stagingRecordId: string,
  ): Promise<{ success: boolean; attendance: any | null }> {
    try {
      const stagingRecord = await prisma.zKTecoAttendanceStaging.findUnique({
        where: { id: stagingRecordId },
      });

      if (!stagingRecord) {
        throw new Error("Staging record not found");
      }

      if (stagingRecord.isFinalized) {
        const existingFinalRecord =
          await prisma.zKTecoAttendanceRecord.findFirst({
            where: { finalizedFrom: stagingRecord.id },
            include: { attendance: true },
          });

        return {
          success: true,
          attendance: existingFinalRecord?.attendance || null,
        };
      }

      const attendance = await this.finalizeSingleRecord(stagingRecord);
      return { success: true, attendance };
    } catch (error) {
      console.error("❌ Error finalizing real-time attendance record:", error);
      return { success: false, attendance: null };
    }
  }

  /**
   * Force finalize a specific staging record (SuperAdmin only)
   */
  public async forceFinalizeStagingRecord(
    stagingRecordId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const stagingRecord = await prisma.zKTecoAttendanceStaging.findUnique({
        where: { id: stagingRecordId },
      });

      if (!stagingRecord) {
        throw new Error("Staging record not found");
      }

      const result =
        await this.finalizeStagingRecordImmediately(stagingRecordId);
      if (!result.success) return false;

      // Update with who forced the finalization
      const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
      await prisma.zKTecoAttendanceStaging.update({
        where: { id: stagingRecordId },
        data: {
          finalizedBy: userId,
          updatedAt: new Date(Date.now() + PKT_OFFSET_MS),
        },
      });

      return true;
    } catch (error) {
      console.error("❌ Error force finalizing record:", error);
      return false;
    }
  }

  /**
   * Force finalize all staging records (SuperAdmin only)
   */
  public async forceFinalizeAllStagingRecords(userId: string): Promise<{
    success: boolean;
    finalized: number;
    errors: number;
  }> {
    try {
      finalizationDebug("🔄 Force finalizing all staging records...");

      const stagingRecords = await prisma.zKTecoAttendanceStaging.findMany({
        where: {
          isFinalized: false,
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      finalizationDebug(
        `📊 Found ${stagingRecords.length} staging records to force finalize`,
      );

      let finalizedCount = 0;
      let errorCount = 0;

      for (const stagingRecord of stagingRecords) {
        try {
          await this.finalizeSingleRecord(stagingRecord);

          // Mark who forced the finalization
          const PKT_MS = 5 * 60 * 60 * 1000;
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: stagingRecord.id },
            data: {
              finalizedBy: userId,
              updatedAt: new Date(Date.now() + PKT_MS),
            },
          });

          finalizedCount++;
        } catch (error) {
          console.error(
            `❌ Error finalizing record ${stagingRecord.id}:`,
            error,
          );
          errorCount++;
        }
      }

      finalizationDebug(
        `✅ Force finalization complete: ${finalizedCount} finalized, ${errorCount} errors`,
      );

      return {
        success: true,
        finalized: finalizedCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error("❌ Error in force finalization process:", error);
      return {
        success: false,
        finalized: 0,
        errors: 0,
      };
    }
  }
}

export const finalizationService = new FinalizationService();
