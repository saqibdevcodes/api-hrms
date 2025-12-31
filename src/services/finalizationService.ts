/**
 * Finalization Service
 * 
 * Handles the 3-day staging to final record finalization process
 * 
 * Flow:
 * 1. Device punches → ZKTecoAttendanceStaging (immediate)
 * 2. After 3 days → ZKTecoAttendanceRecord (finalized)
 * 3. After 3 days → Attendance table (finalized)
 */

import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export class FinalizationService {
  /**
   * Finalize staging records that are 3+ days old
   * This should be run by a cron job every hour or day
   */
  public async finalizeStagingRecords(): Promise<{
    success: boolean;
    finalized: number;
    errors: number;
  }> {
    try {
      console.log("🔄 Starting finalization process...");

      // Find all staging records that are 3+ days old and not yet finalized
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const stagingRecords = await prisma.zKTecoAttendanceStaging.findMany({
        where: {
          isFinalized: false,
          createdAt: {
            lte: threeDaysAgo,
          },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      console.log(
        `📊 Found ${stagingRecords.length} staging records to finalize`
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
            error
          );
          errorCount++;
        }
      }

      console.log(
        `✅ Finalization complete: ${finalizedCount} finalized, ${errorCount} errors`
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
  private async finalizeSingleRecord(stagingRecord: any): Promise<void> {
    console.log(`\n🔄 Finalizing record ${stagingRecord.id}...`);

    // Step 1: Create final ZKTeco record
    const finalRecord = await prisma.zKTecoAttendanceRecord.create({
      data: {
        employeeId: stagingRecord.employeeId,
        deviceId: stagingRecord.deviceId,
        timestamp: stagingRecord.timestamp,
        checkType: stagingRecord.checkType,
        verifyType: stagingRecord.verifyType,
        workCode: stagingRecord.workCode,
        overallStatus: stagingRecord.overallStatus,
        processed: false, // Will be processed when creating attendance
        processingError: stagingRecord.processingError,
        userId: stagingRecord.userId,
        finalizedFrom: stagingRecord.id,
        finalizedAt: new Date(),
      },
    });

    console.log(`✅ Created final record: ${finalRecord.id}`);

    // Step 2: Create or update attendance record
    console.log(`🔍 Checking attendance creation conditions:`);
    console.log(`   userId: ${stagingRecord.userId}`);
    console.log(`   processingError: ${stagingRecord.processingError}`);
    
    // Skip only if there's a real error (not just tracking notes)
    const isRealError = stagingRecord.processingError && 
                        !stagingRecord.processingError.includes('(deduction in final table)') &&
                        !stagingRecord.processingError.includes('(will apply in final table)');
    
    if (stagingRecord.userId && !isRealError) {
      console.log(`✅ Conditions met, finding employee...`);
      const employee = await prisma.user.findUnique({
        where: { id: stagingRecord.userId },
        include: { shift: true },
      });

      console.log(`   Employee found: ${employee ? 'Yes' : 'No'}`);
      if (employee) {
        console.log(`   Employee: ${employee.firstName} ${employee.lastName} (${employee.id})`);
        const attendanceDate = new Date(stagingRecord.timestamp);
        const dateOnly = new Date(
          Date.UTC(
            attendanceDate.getUTCFullYear(),
            attendanceDate.getUTCMonth(),
            attendanceDate.getUTCDate()
          )
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
              lastDeviceSync: new Date(),
              notes: `Finalized from staging record ${stagingRecord.id}`,
            },
          });

          console.log(`✅ Created attendance record: ${attendance.id}`);
        } else {
          // Update existing attendance record
          const updateData: any = {
            status: "PRESENT",
            lastDeviceSync: new Date(),
          };

          if (
            stagingRecord.checkType === "check_in" &&
            !attendance.checkIn
          ) {
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

          console.log(`✅ Updated attendance record: ${attendance.id}`);
        }

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
        finalizedAt: new Date(),
      },
    });

    console.log(`✅ Marked staging record as finalized`);
  }

  /**
   * Force finalize a specific staging record (SuperAdmin only)
   */
  public async forceFinalizeStagingRecord(
    stagingRecordId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const stagingRecord = await prisma.zKTecoAttendanceStaging.findUnique({
        where: { id: stagingRecordId },
      });

      if (!stagingRecord) {
        throw new Error("Staging record not found");
      }

      if (stagingRecord.isFinalized) {
        throw new Error("Record already finalized");
      }

      await this.finalizeSingleRecord(stagingRecord);

      // Update with who forced the finalization
      await prisma.zKTecoAttendanceStaging.update({
        where: { id: stagingRecordId },
        data: {
          finalizedBy: userId,
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
      console.log("🔄 Force finalizing all staging records...");

      const stagingRecords = await prisma.zKTecoAttendanceStaging.findMany({
        where: {
          isFinalized: false,
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      console.log(
        `📊 Found ${stagingRecords.length} staging records to force finalize`
      );

      let finalizedCount = 0;
      let errorCount = 0;

      for (const stagingRecord of stagingRecords) {
        try {
          await this.finalizeSingleRecord(stagingRecord);

          // Mark who forced the finalization
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: stagingRecord.id },
            data: {
              finalizedBy: userId,
            },
          });

          finalizedCount++;
        } catch (error) {
          console.error(
            `❌ Error finalizing record ${stagingRecord.id}:`,
            error
          );
          errorCount++;
        }
      }

      console.log(
        `✅ Force finalization complete: ${finalizedCount} finalized, ${errorCount} errors`
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

