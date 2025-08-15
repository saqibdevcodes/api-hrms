import { Router } from "express";
import multer from "multer";
import path from "path";
import { EmployeeController } from "../controller/employeeController";
import {
  createEmployeeValidation,
  updateEmployeeValidation,
} from "../validators/employeeValidator";
import { authenticate, hrAndAdmin, validateRequest } from "../middleware/auth";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), "uploads");
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});

// File filter for allowed file types
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Allow images for CNIC files
  if (file.fieldname === "cnicFrontFile" || file.fieldname === "cnicBackFile") {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("CNIC files must be images"), false);
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
]);

// GET /api/employees/form-data - Get dropdown data for employee form
router.get("/form-data", authenticate, EmployeeController.getFormData);

// GET /api/employees/designations - Get designations filtered by department
router.get(
  "/designations",
  authenticate,
  EmployeeController.getDesignationsByDepartment
);

// GET /api/employees/supervisors-by-rank - Get supervisors filtered by rank
router.get(
  "/supervisors-by-rank",
  authenticate,
  EmployeeController.getSupervisorsByRank
);

// GET /api/employees - Get all employees (HR and Admin only)
router.get("/", authenticate, hrAndAdmin, EmployeeController.getAllEmployees);

// GET /api/employees/:id - Get employee by ID (HR and Admin only)
router.get(
  "/:id",
  authenticate,
  hrAndAdmin,
  EmployeeController.getEmployeeById
);

// POST /api/employees - Create new employee (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  uploadFields, // Add multer middleware before validation
  createEmployeeValidation,
  validateRequest,
  EmployeeController.createEmployee
);

// PUT /api/employees/:id - Update employee (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  uploadFields, // Add multer middleware for updates too
  updateEmployeeValidation,
  validateRequest,
  EmployeeController.updateEmployee
);

// DELETE /api/employees/:id - Delete employee (Admin only)
router.delete(
  "/:id",
  authenticate,
  hrAndAdmin,
  EmployeeController.deleteEmployee
);

export default router;
