"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const env_1 = require("../config/env");
const employeeController_1 = require("../controller/employeeController");
const employeeValidator_1 = require("../validators/employeeValidator");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Determine if Cloudinary is configured
const isCloudinaryConfigured = !!(env_1.config.CLOUDINARY_CLOUD_NAME &&
    env_1.config.CLOUDINARY_API_KEY &&
    env_1.config.CLOUDINARY_API_SECRET);
// Configure storage based on environment
const storage = isCloudinaryConfigured
    ? new multer_storage_cloudinary_1.CloudinaryStorage({
        cloudinary: cloudinary_1.default,
        params: async (req, file) => {
            return {
                folder: "hrms/employees",
                allowed_formats: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"],
                public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
                resource_type: file.mimetype.startsWith("image/") ? "image" : "raw",
            };
        },
    })
    : multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path_1.default.join(process.cwd(), "uploads");
            if (!fs_1.default.existsSync(uploadPath)) {
                fs_1.default.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const extension = path_1.default.extname(file.originalname);
            cb(null, file.fieldname + "-" + uniqueSuffix + extension);
        },
    });
// File filter for allowed file types
const fileFilter = (req, file, cb) => {
    // Allow images for CNIC files, insurance card, and profile picture
    if (file.fieldname === "cnicFrontFile" ||
        file.fieldname === "cnicBackFile" ||
        file.fieldname === "insuranceCardFile" ||
        file.fieldname === "profilePictureFile") {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("CNIC, insurance card, and profile picture files must be images"), false);
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
        }
        else {
            cb(new Error("Document must be PDF, image, or Word document"), false);
        }
    }
    else {
        cb(new Error("Unexpected field"), false);
    }
};
// Configure multer upload
const upload = (0, multer_1.default)({
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
router.get("/form-data", auth_1.authenticate, employeeController_1.EmployeeController.getFormData);
// GET /api/employees/has-system-access - Get if employee has system access
router.get("/has-system-access", auth_1.authenticate, employeeController_1.EmployeeController.getHasSystemAccessEmplyees);
// GET /api/employees/designations - Get designations filtered by department
router.get("/designations", auth_1.authenticate, employeeController_1.EmployeeController.getDesignationsByDepartment);
// GET /api/employees/supervisors-by-rank - Get supervisors filtered by rank
router.get("/supervisors-by-rank", auth_1.authenticate, employeeController_1.EmployeeController.getSupervisorsByRank);
// GET /api/employees - Get all employees (HR and Admin only)
router.get("/", auth_1.authenticate, auth_1.hrAndAdmin, employeeController_1.EmployeeController.getAllEmployees);
// GET /api/employees/:id - Get employee by ID (HR and Admin only)
router.get("/:id", auth_1.authenticate, auth_1.hrAndAdmin, employeeController_1.EmployeeController.getEmployeeById);
// POST /api/employees - Create new employee (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, uploadFields, // Add multer middleware before validation
employeeValidator_1.createEmployeeValidation, auth_1.validateRequest, employeeController_1.EmployeeController.createEmployee);
// PUT /api/employees/:id - Update employee (HR and Admin only)
router.put("/:id", auth_1.authenticate, auth_1.hrAndAdmin, uploadFields, // Add multer middleware for updates too
employeeValidator_1.updateEmployeeValidation, auth_1.validateRequest, employeeController_1.EmployeeController.updateEmployee);
// PATCH /api/employees/:id/toggle - Toggle employee status (HR and Admin only)
router.patch("/:id/toggle", auth_1.authenticate, auth_1.hrAndAdmin, employeeController_1.EmployeeController.toggleEmployeeStatus);
// DELETE /api/employees/:id - Delete employee (Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, employeeController_1.EmployeeController.deleteEmployee);
exports.default = router;
