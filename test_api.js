/**
 * Test Attendance API
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAPI() {
  try {
    console.log('🔍 Testing attendance API logic...\n');

    // Simulate the API logic
    const currentUser = {
      id: 'cmih46hfm000lcigs6edq0lpi',
      email: 'admin@iris-communications.com',
      role: 'ADMIN'
    };

    console.log(`👤 User: ${currentUser.email} (${currentUser.role})`);

    // Build where clause (same as API)
    let where = {};

    if (currentUser.role === "EMPLOYEE") {
      where.employeeId = currentUser.id;
      console.log(`🔒 Employee filter: Only show own records`);
    } else if (currentUser.role === "ADMIN") {
      console.log(`🔓 Admin filter: Show all records`);
    }

    console.log(`\n📊 Where clause:`, JSON.stringify(where, null, 2));

    // Query database
    console.log(`\n🔍 Querying database...`);
    const attendanceRecords = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 20,
    });

    console.log(`\n✅ Found ${attendanceRecords.length} records:`);
    attendanceRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. ID: ${record.id}`);
      console.log(`   Employee: ${record.employee.firstName} ${record.employee.lastName}`);
      console.log(`   Date: ${record.date}`);
      console.log(`   Check In: ${record.checkIn}`);
      console.log(`   Check Out: ${record.checkOut}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Notes: ${record.notes}`);
    });

    if (attendanceRecords.length === 0) {
      console.log('\n❌ No records found!');
      console.log('\n🔍 Let me check what\'s in the database...');
      
      const allRecords = await prisma.attendance.findMany({
        select: {
          id: true,
          employeeId: true,
          date: true,
          status: true,
        }
      });
      
      console.log(`\n📊 Total records in database: ${allRecords.length}`);
      allRecords.forEach((r, i) => {
        console.log(`${i + 1}. ID: ${r.id}, Employee: ${r.employeeId}, Date: ${r.date}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();



