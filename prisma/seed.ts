import "dotenv/config";
import {
  Role,
  UserRank,
  BloodGroup,
  EducationLevel,
  MaritalStatus,
  Gender,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

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

  const softwareEngineerDesignation = await prisma.designation.upsert({
    where: { title: "Software Engineer" },
    update: {},
    create: {
      title: "Software Engineer",
      description: "Develops and maintains software applications",
      level: 4,
      department: "Engineering",
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
      isActive: true,
    },
  });

  // Create emergency contact
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

  const superAdminDept = await prisma.department.upsert({
    where: { name: "Super Admin Dept" },
    update: {},
    create: {
      name: "Super Admin Dept",
      description: "Department for Super Admin",
      manager: "Super Admin",
      budget: 100000,
      isActive: true,
    },
  });

  const testEmployeeDept = await prisma.department.upsert({
    where: { name: "Information Technology" },
    update: {},
    create: {
      name: "Information Technology",
      description: "IT Department",
      manager: "Wasif Zia",
      budget: 300000,
      isActive: true,
    },
  });

  const superAdminEmergencyContact = await prisma.emergencyDetail.create({
    data: {
      contactName: "Super Admin Contact",
      contactPhone: "+92-301-0000000",
      contactEmail: "super.admin@example.com",
      relationship: "Super Admin",
      contactAddress: "Super Admin Address",
      alternatePhone: "+92-21-0000000",
      isActive: true,
    },
  });

  const testEmployeeEmergencyContact = await prisma.emergencyDetail.create({
    data: {
      contactName: "Abdullah Javaid",
      contactPhone: "+92-322-4913133",
      contactEmail: "maketoy3@gmail.com",
      relationship: "Brother",
      contactAddress: "117B Block Tajpura Scheme,Lahore,Pakistan",
      alternatePhone: "+92-21-6969696",
      isActive: true,
    },
  });

  console.log("Creating HR user...");
  const hrUser = await prisma.user.create({
    data: {
      // Basic info
      email: "nadia@iriscommunications.com.pk",
      firstName: "Nadia",
      lastName: "Hassan",
      fatherHusbandName: "Rana Muhammad Afzal (late)",
      cnic: "31202-3679738-6",
      cnicExpiry: new Date("2030-09-09"),
      maritalStatus: MaritalStatus.MARRIED,
      dateOfBirth: new Date("1981-10-20"),
      bloodGroup: BloodGroup.O_POSITIVE,
      gender: Gender.FEMALE,

      // Education
      education: EducationLevel.BACHELORS,
      educationInstitute: "Lahore University of Management Sciences",
      educationGrade: "B+",

      // Contact
      personalEmail: "nadiahassanlodhi@gmail.com",
      personalMobile: "+92-334-5105890",
      officialMobile: "+92-300-8456247",
      officialEmail: "nadia@iriscommunications.com.pk",
      phone: "+92-334-5105890",

      // Address
      personalAddress: "215 & 216, Ahmedyar block, lahore, Pakistan",
      address: "Iris Communications Office,Y bock ,DHA Phase III, Lahore",
      city: "Lahore",
      state: "Punjab",
      zipCode: "45646",
      country: "Pakistan",

      // Employment
      employeeId: "IC-HR001",
      userRank: UserRank.LINE_MANAGER,
      password: await bcrypt.hash("NadiaH@123", 10),
      role: Role.HR,
      position: "HR Manager",
      department: "Human Resources",
      manager: "Admin",
      status: UserStatus.ACTIVE, // Added this assuming you want an active status
    },
  });

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
