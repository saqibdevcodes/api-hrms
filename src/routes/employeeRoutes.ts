import { Router } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import fs from "fs";
import cloudinary from "../config/cloudinary";
import { config } from "../config/env";
import { EmployeeController } from "../controller/employeeController";
import {
  createEmployeeValidation,
  updateEmployeeValidation,
} from "../validators/employeeValidator";
import { authenticate, hrAndAdmin, managerAndAbove, validateRequest } from "../middleware/auth";

const router = Router();

// Determine if Cloudinary is configured
const isCloudinaryConfigured = !!(
  config.CLOUDINARY_CLOUD_NAME &&
  config.CLOUDINARY_API_KEY &&
  config.CLOUDINARY_API_SECRET
);

// Configure storage based on environment
const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: async (req, file) => {
        return {
          folder: "hrms/employees",
          allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"],
          public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          resource_type: file.mimetype.startsWith("image/") ? "image" : "raw",
        };
      },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + "-" + uniqueSuffix + extension);
      },
    });

// File filter for allowed file types
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Allow images for CNIC files, insurance card, and profile picture
  if (
    file.fieldname === "cnicFrontFile" ||
    file.fieldname === "cnicBackFile" ||
    file.fieldname === "insuranceCardFile" ||
    file.fieldname === "profilePictureFile"
  ) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "CNIC, insurance card, and profile picture files must be images",
        ),
        false,
      );
    }
  }
  // Allow documents (PDF, images, docs) for general documents
  else if (file.fieldname === "documentFile") {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Document must be PDF, image, or Word document"), false);
    }
  } else {
    cb(new Error("Unexpected field"), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Multer fields configuration
const uploadFields = upload.fields([
  { name: "cnicFrontFile", maxCount: 1 },
  { name: "cnicBackFile", maxCount: 1 },
  { name: "documentFile", maxCount: 1 },
  { name: "insuranceCardFile", maxCount: 1 },
  { name: "profilePictureFile", maxCount: 1 },
]);

// GET /api/employees/form-data - Get dropdown data for employee form
router.get("/form-data", authenticate, EmployeeController.getFormData);

// GET /api/employees/has-system-access - Get if employee has system access
router.get(
  "/has-system-access",
  authenticate,
  EmployeeController.getHasSystemAccessEmplyees,
);

// GET /api/employees/designations - Get designations filtered by department
router.get(
  "/designations",
  authenticate,
  EmployeeController.getDesignationsByDepartment,
);

// GET /api/employees/supervisors-by-rank - Get supervisors filtered by rank
router.get(
  "/supervisors-by-rank",
  authenticate,
  EmployeeController.getSupervisorsByRank,
);

// GET /api/employees - Get all employees (HR, Admin, and Managers)
router.get("/", authenticate, managerAndAbove, EmployeeController.getAllEmployees);

// GET /api/employees/employeeStatus/:id - Get employee status (for dashboard)
router.get("/employeeStatus/:id", EmployeeController.getEmployeeStatus);

// GET /api/employees/:id - Get employee by ID (HR and Admin only)
router.get(
  "/:id",
  authenticate,
  hrAndAdmin,
  EmployeeController.getEmployeeById,
);

// POST /api/employees - Create new employee (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  uploadFields, // Add multer middleware before validation
  createEmployeeValidation,
  validateRequest,
  EmployeeController.createEmployee,
);

// PUT /api/employees/:id - Update employee (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  uploadFields, // Add multer middleware for updates too
  updateEmployeeValidation,
  validateRequest,
  EmployeeController.updateEmployee,
);

// PATCH /api/employees/:id/toggle - Toggle employee status (HR and Admin only)
router.patch(
  "/:id/toggle",
  authenticate,
  hrAndAdmin,
  EmployeeController.toggleEmployeeStatus,
);

// DELETE /api/employees/:id - Delete employee (Admin only)
router.delete(
  "/:id",
  authenticate,
  hrAndAdmin,
  EmployeeController.deleteEmployee,
);

export default router;
