/**
 * Reprocess failed ZKTeco attendance records
 * This script will reprocess all records that failed due to "Employee not found"
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reprocessFailedRecords() {
  try {
    console.log('🔄 Finding failed attendance records...');
    
    // Find all unprocessed records with employee not found error
    const failedRecords = await prisma.zKTecoAttendanceRecord.findMany({
      where: {
        processed: false,
        processingError: {
          contains: 'Employee not found'
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    console.log(`📊 Found ${failedRecords.length} failed records to reprocess`);

    for (const record of failedRecords) {
      console.log(`\n🔄 Reprocessing record ${record.id}...`);
      console.log(`   Employee ID: ${record.employeeId}`);
      console.log(`   Timestamp: ${record.timestamp}`);
      console.log(`   Check Type: ${record.checkType}`);

      // Find employee
      const employee = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: record.employeeId },
            { id: record.employeeId }
          ]
        },
        include: {
          shift: true
        }
      });

      if (!employee) {
        console.log(`   ❌ Still no employee found for ID: ${record.employeeId}`);
        continue;
      }

      console.log(`   ✅ Found employee: ${employee.firstName} ${employee.lastName}`);

      // Update the ZKTeco record with userId
      await prisma.zKTecoAttendanceRecord.update({
        where: { id: record.id },
        data: {
          userId: employee.id,
          processingError: null
        }
      });

      // Get date only (UTC midnight)
      const attendanceDate = new Date(record.timestamp);
      const dateOnly = new Date(
        Date.UTC(
          attendanceDate.getUTCFullYear(),
          attendanceDate.getUTCMonth(),
          attendanceDate.getUTCDate()
        )
      );

      // Find or create attendance record
      let attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          date: dateOnly
        }
      });

      if (!attendance) {
        console.log(`   📝 Creating new attendance record...`);
        attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: dateOnly,
            checkIn: record.checkType === 'check_in' ? record.timestamp : null,
            checkOut: record.checkType === 'check_out' ? record.timestamp : null,
            status: 'PRESENT',
            deviceCheckIns: record.checkType === 'check_in' ? 1 : 0,
            deviceCheckOuts: record.checkType === 'check_out' ? 1 : 0,
            lastDeviceSync: new Date(),
            notes: `Reprocessed from ZKTeco device ${record.deviceId}`
          }
        });
        console.log(`   ✅ Created attendance record: ${attendance.id}`);
      } else {
        console.log(`   📝 Updating existing attendance record...`);
        const updateData = {
          status: 'PRESENT',
          lastDeviceSync: new Date()
        };

        if (record.checkType === 'check_in' && !attendance.checkIn) {
          updateData.checkIn = record.timestamp;
          updateData.deviceCheckIns = (attendance.deviceCheckIns || 0) + 1;
        } else if (record.checkType === 'check_out' && !attendance.checkOut) {
          updateData.checkOut = record.timestamp;
          updateData.deviceCheckOuts = (attendance.deviceCheckOuts || 0) + 1;
          
          if (attendance.checkIn) {
            const workingMs = record.timestamp.getTime() - attendance.checkIn.getTime();
            const workingHours = workingMs / (1000 * 60 * 60);
            updateData.totalHours = Math.round(workingHours * 100) / 100;
          }
        }

        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: updateData
        });
        console.log(`   ✅ Updated attendance record: ${attendance.id}`);
      }

      // Mark ZKTeco record as processed
      await prisma.zKTecoAttendanceRecord.update({
        where: { id: record.id },
        data: {
          attendanceId: attendance.id,
          processed: true,
          processingError: null
        }
      });

      console.log(`   ✅ Marked record as processed`);
    }

    console.log(`\n✅ Reprocessing complete!`);
    console.log(`📊 Processed ${failedRecords.length} records`);

  } catch (error) {
    console.error('❌ Error reprocessing records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessFailedRecords();



