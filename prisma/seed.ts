import {
  PrismaClient,
  Role,
  UserRank,
  BloodGroup,
  EducationLevel,
  MaritalStatus,
  Gender,
  UserStatus,
} from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create employment types first
  console.log("Creating employment types...");
  const fullTimeType = await prisma.employmentType.upsert({
    where: { name: "Full-Time" },
    update: {},
    create: {
      name: "Full-Time",
      description: "Regular full-time employment with benefits",
      isActive: true,
    },
  });

  const partTimeType = await prisma.employmentType.upsert({
    where: { name: "Part-Time" },
    update: {},
    create: {
      name: "Part-Time",
      description: "Part-time employment with flexible hours",
      isActive: true,
    },
  });

  const contractEmploymentType = await prisma.employmentType.upsert({
    where: { name: "Contract" },
    update: {},
    create: {
      name: "Contract",
      description: "Contract-based employment for specific projects",
      isActive: true,
    },
  });

  const internshipType = await prisma.employmentType.upsert({
    where: { name: "Internship" },
    update: {},
    create: {
      name: "Internship",
      description: "Temporary learning position for students",
      isActive: true,
    },
  });

  const consultantType = await prisma.employmentType.upsert({
    where: { name: "Consultant" },
    update: {},
    create: {
      name: "Consultant",
      description: "External consultant providing specialized services",
      isActive: true,
    },
  });

  // Create departments
  console.log("Creating departments...");
  const engineeringDept = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: {
      name: "Engineering",
      description: "Software development and technical operations",
      manager: "John Smith",
      budget: 500000,
      isActive: true,
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: "Human Resources" },
    update: {},
    create: {
      name: "Human Resources",
      description: "Employee management and organizational development",
      manager: "Sarah Johnson",
      budget: 200000,
      isActive: true,
    },
  });

  // Create designations
  console.log("Creating designations...");
  const ceoDesignation = await prisma.designation.upsert({
    where: { title: "Chief Executive Officer" },
    update: {},
    create: {
      title: "Chief Executive Officer",
      description: "Top executive responsible for overall company operations",
      level: 1,
      department: "Executive",
      isActive: true,
    },
  });

  const hrManagerDesignation = await prisma.designation.upsert({
    where: { title: "HR Manager" },
    update: {},
    create: {
      title: "HR Manager",
      description: "Manages human resources department and policies",
      level: 3,
      department: "Human Resources",
      isActive: true,
    },
  });

  // Create contract types
  console.log("Creating contract types...");
  const permanentContract = await prisma.contractType.upsert({
    where: { name: "Permanent" },
    update: {},
    create: {
      name: "Permanent",
      description: "Permanent employment contract",
      duration: null,
      isActive: true,
    },
  });

  const temporaryContract = await prisma.contractType.upsert({
    where: { name: "Temporary" },
    update: {},
    create: {
      name: "Temporary",
      description: "Temporary employment contract",
      duration: 6,
      isActive: true,
    },
  });

  // Create shifts
  console.log("Creating shifts...");
  const morningShift = await prisma.shift.upsert({
    where: { name: "Morning Shift" },
    update: {},
    create: {
      name: "Morning Shift",
      startTime: new Date("2024-01-01T09:30:00Z"), // 09:30 AM
      endTime: new Date("2024-01-01T18:00:00Z"), // 06:00 PM
      breakTime: 60, // 60 minutes break
      halfDayStart: new Date("2024-01-01T11:00:00Z"), // 11:00 AM - Half Day Start
      fullDayStart: new Date("2024-01-01T13:00:00Z"), // 01:00 PM - Full Day Start
      earlyOut: new Date("2024-01-01T17:00:00Z"), // 05:00 PM - Early Out
      isActive: true,
    },
  });

  // Create leave policies
  console.log("Creating leave policies...");
  const standardLeavePolicy = await prisma.leavePolicy.upsert({
    where: { name: "Standard Policy" },
    update: {},
    create: {
      name: "Standard Policy",
      annualLeaves: 21,
      sickLeaves: 10,
      casualLeaves: 5,
      maternityLeaves: 90,
      paternityLeaves: 15,
      isActive: true,
    },
  });

  // Create emergency contact
  console.log("Creating emergency contacts...");
  const adminEmergencyContact = await prisma.emergencyDetail.create({
    data: {
      contactName: "Jane Smith",
      contactPhone: "+92-300-1234567",
      contactEmail: "jane.smith@example.com",
      relationship: "Spouse",
      contactAddress: "123 Main Street, Lahore, Pakistan",
      alternatePhone: "+92-42-1234567",
      isActive: true,
    },
  });

  const hrEmergencyContact = await prisma.emergencyDetail.create({
    data: {
      contactName: "Michael Johnson",
      contactPhone: "+92-301-7654321",
      contactEmail: "michael.johnson@example.com",
      relationship: "Brother",
      contactAddress: "456 Oak Avenue, Karachi, Pakistan",
      alternatePhone: "+92-21-7654321",
      isActive: true,
    },
  });

  // Create users with employee data
  console.log("Creating admin user...");
  const adminUser = await prisma.user.create({
    data: {
      // Basic info
      email: "admin@iris-communications.com",
      firstName: "Admin",
      lastName: "User",
      fatherHusbandName: "Muhammad Ali",
      cnic: "42101-1234567-1",
      cnicExpiry: new Date("2030-12-31"),
      maritalStatus: MaritalStatus.MARRIED,
      dateOfBirth: new Date("1985-01-15"),
      bloodGroup: BloodGroup.A_POSITIVE,
      gender: Gender.MALE,

      // Education
      education: EducationLevel.MASTERS,
      educationInstitute: "University of Punjab",
      educationGrade: "A",

      // Contact
      personalEmail: "admin.personal@gmail.com",
      personalMobile: "+92-300-1234567",
      officialMobile: "+92-300-1111111",
      officialEmail: "admin@iris-communications.com",
      phone: "+92-42-1234567",

      // Address
      personalAddress: "123 Main Street, Lahore, Pakistan",
      address: "Iris Communications Office, Gulberg III, Lahore",
      city: "Lahore",
      state: "Punjab",
      zipCode: "54000",
      country: "Pakistan",

      // Employment
      employeeId: "IC-ADM001",
      userRank: UserRank.DIRECTOR_LEVEL,
      password: await bcrypt.hash("admin123", 10),
      role: Role.ADMIN,
      position: "System Administrator",
      department: "Engineering",
      manager: null,
      salary: 150000,
      currency: "PKR",
      dateOfJoining: new Date("2023-01-01"),
      hireDate: new Date("2023-01-01"),
      employmentTypeId: fullTimeType.id,

      // Emergency contact

      emergencyDetailId: adminEmergencyContact.id,

      // Relations
      departmentId: engineeringDept.id,
      contractTypeId: permanentContract.id,
      designationId: ceoDesignation.id,
      shiftId: morningShift.id,
      leaveId: standardLeavePolicy.id,

      // System fields
      status: UserStatus.ACTIVE,
      isActive: true,
    },
  });

  console.log("Creating HR user...");
  const hrUser = await prisma.user.create({
    data: {
      // Basic info
      email: "hr@iris-communications.com",
      firstName: "Sarah",
      lastName: "Johnson",
      fatherHusbandName: "Robert Johnson",
      cnic: "42101-7654321-2",
      cnicExpiry: new Date("2029-06-30"),
      maritalStatus: MaritalStatus.SINGLE,
      dateOfBirth: new Date("1990-03-22"),
      bloodGroup: BloodGroup.B_POSITIVE,
      gender: Gender.FEMALE,

      // Education
      education: EducationLevel.BACHELORS,
      educationInstitute: "Lahore University of Management Sciences",
      educationGrade: "B+",

      // Contact
      personalEmail: "sarah.personal@gmail.com",
      personalMobile: "+92-301-7654321",
      officialMobile: "+92-301-2222222",
      officialEmail: "hr@iris-communications.com",
      phone: "+92-42-7654321",

      // Address
      personalAddress: "456 Oak Avenue, Karachi, Pakistan",
      address: "Iris Communications Office, Gulberg III, Lahore",
      city: "Karachi",
      state: "Sindh",
      zipCode: "75000",
      country: "Pakistan",

      // Employment
      employeeId: "IC-HR001",
      userRank: UserRank.LINE_MANAGER,
      password: await bcrypt.hash("hr123123", 10),
      role: Role.ADMIN,
      position: "HR Manager",
      department: "Human Resources",
      manager: "Admin User",
      salary: 80000,
      currency: "PKR",
      dateOfJoining: new Date("2023-02-15"),
      hireDate: new Date("2023-02-15"),
      employmentTypeId: fullTimeType.id,

      // Emergency contact
      emergencyDetailId: hrEmergencyContact.id,

      // Relations
      departmentId: hrDept.id,
      contractTypeId: permanentContract.id,
      designationId: hrManagerDesignation.id,
      shiftId: morningShift.id,
      leaveId: standardLeavePolicy.id,

      // System fields
      status: UserStatus.ACTIVE,
      isActive: true,
    },
  });



 


  console.log("Creating Normal Employee user...");
  const lineManagerUser = await prisma.user.create({
    data: {
      // Basic info
      email: "wasif@iriscommunications.com.pk",
      firstName: "Wasif",
      lastName: "Zia",
      fatherHusbandName: "Muhammad Zia",
      cnic: "42101-7654321-4",
      cnicExpiry: new Date("2028-06-30"),
      maritalStatus: MaritalStatus.MARRIED,
      dateOfBirth: new Date("1990-08-22"),
      bloodGroup: BloodGroup.B_POSITIVE,
      gender: Gender.MALE,

      // Education
      education: EducationLevel.BACHELORS,
      educationInstitute: "Lahore University of Management Sciences",
      educationGrade: "B+",

      // Contact
      personalEmail: "wasif.personal@gmail.com",
      personalMobile: "+92-301-7654323",
      officialMobile: "+92-301-2229223",
      officialEmail: "wasif@iriscommunications.com",
      phone: "+92-42-7654323",

      // Address
      personalAddress: "456 Oak Avenue, Karachi, Pakistan",
      address: "Iris Communications Office, Gulberg III, Lahore",
      city: "Karachi",
      state: "Sindh",
      zipCode: "75000",
      country: "Pakistan",

      // Employment
      employeeId: "IC-EMP009",
      userRank: UserRank.LINE_MANAGER,
      password: await bcrypt.hash("emp123123", 10),
      role: Role.EMPLOYEE,
      position: "Software Engineer",
      department: "Engineering",
      manager: "Sn",
      salary: 50000,
      currency: "PKR",
      dateOfJoining: new Date("2022-02-15"),
      hireDate: new Date("2022-02-15"),
      employmentTypeId: fullTimeType.id,

      // Emergency contact
      emergencyDetailId: hrEmergencyContact.id,

      // Relations
      departmentId: hrDept.id,
      contractTypeId: permanentContract.id,
      designationId: hrManagerDesignation.id,
      shiftId: morningShift.id,
      leaveId: standardLeavePolicy.id,

      // System fields
      status: UserStatus.ACTIVE,
      isActive: true,
    },
  });


  console.log("Creating Normal Employee user...");
  const employeeUser = await prisma.user.create({
    data: {
      // Basic info
      email: "shaheen@iris-communications.com.pk",
      firstName: "Shaheen",
      lastName: "Khan",
      fatherHusbandName: "Muhammad Khan",
      cnic: "42101-7654321-3",
      cnicExpiry: new Date("2029-06-30"),
      maritalStatus: MaritalStatus.SINGLE,
      dateOfBirth: new Date("1990-03-22"),
      bloodGroup: BloodGroup.B_POSITIVE,
      gender: Gender.MALE,

      // Education
      education: EducationLevel.BACHELORS,
      educationInstitute: "Lahore University of Management Sciences",
      educationGrade: "B+",

      // Contact
      personalEmail: "shaheen.personal@gmail.com",
      personalMobile: "+92-301-7654322",
      officialMobile: "+92-301-2222223",
      officialEmail: "shaheen@iris-communications.com",
      phone: "+92-42-7654322",

      // Address
      personalAddress: "456 Oak Avenue, Karachi, Pakistan",
      address: "Iris Communications Office, Gulberg III, Lahore",
      city: "Karachi",
      state: "Sindh",
      zipCode: "75000",
      country: "Pakistan",

      // Employment
      employeeId: "IC-EMP001",
      userRank: UserRank.EMPLOYEE,
      password: await bcrypt.hash("emp123123", 10),
      role: Role.EMPLOYEE,
      position: "Software Engineer",
      department: "Engineering",
      manager: lineManagerUser.id,
      salary: 50000,
      currency: "PKR",
      dateOfJoining: new Date("2022-02-15"),
      hireDate: new Date("2022-02-15"),
      employmentTypeId: fullTimeType.id,

      // Emergency contact
      emergencyDetailId: hrEmergencyContact.id,

      // Relations
      departmentId: hrDept.id,
      contractTypeId: permanentContract.id,
      designationId: hrManagerDesignation.id,
      shiftId: morningShift.id,
      leaveId: standardLeavePolicy.id,

      // System fields
      status: UserStatus.ACTIVE,
      isActive: true,
    },
  });



  console.log("✅ Database seeded successfully!");
  // Create employee leave records for testing progressive deductions
  console.log("Creating employee leave records...");

  await prisma.employeeLeave.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      annualLeaves: 21,
      sickLeaves: 10,
      casualLeaves: 5, // This will be deducted when 2 half days = 1 full day
      compensatoryLeaves: 0,
      maternityLeaves: 0,
      paternityLeaves: 0,
      leavePolicyId: standardLeavePolicy.id,
      datetime: new Date(),
    },
  });

  await prisma.employeeLeave.upsert({
    where: { userId: hrUser.id },
    update: {},
    create: {
      userId: hrUser.id,
      annualLeaves: 21,
      sickLeaves: 10,
      casualLeaves: 5,
      compensatoryLeaves: 0,
      maternityLeaves: 0,
      paternityLeaves: 0,
      leavePolicyId: standardLeavePolicy.id,
      datetime: new Date(),
    },
  });

  console.log(`📊 Created:`);
  console.log(`   - ${5} Employment Types`);
  console.log(`   - ${2} Departments`);
  console.log(`   - ${2} Designations`);
  console.log(`   - ${2} Contract Types`);
  console.log(`   - ${1} Shift`);
  console.log(`   - ${1} Leave Policy`);
  console.log(`   - ${2} Emergency Contacts`);
  console.log(`   - ${2} Users/Employees`);
  console.log(`   - ${2} Employee Leave Records`);

  console.log("\n👤 Demo Accounts:");
  console.log("   Admin: admin@iris-communications.com / admin123");
  console.log("   HR: hr@iris-communications.com / hr123123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
