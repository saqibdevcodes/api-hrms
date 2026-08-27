import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { TicketController } from "../controller/ticketController";
import { authenticate } from "../middleware/auth";
import cloudinary from "../config/cloudinary";
import { config } from "../config/env";

const router = Router();
const ticketUploadPath = path.join(process.cwd(), "uploads", "tickets");

const localStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(ticketUploadPath, { recursive: true });
    callback(null, ticketUploadPath);
  },
  filename: (_req, file, callback) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 60);
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${safeBase || "attachment"}-${suffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const isCloudinaryConfigured = Boolean(
  config.CLOUDINARY_CLOUD_NAME &&
    config.CLOUDINARY_API_KEY &&
    config.CLOUDINARY_API_SECRET,
);

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req, file) => ({
        folder: "hrms/tickets",
        public_id: `ticket-${Date.now()}-${Math.round(Math.random() * 1e9)}-${path
          .basename(file.originalname, path.extname(file.originalname))
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .slice(0, 40)}`,
        resource_type: "auto",
      }),
    })
  : localStorage;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Unsupported attachment type"));
      return;
    }
    callback(null, true);
  },
});

router.use(authenticate);

router.get("/summary", TicketController.summary);
router.get("/meta", TicketController.meta);
router.post("/categories", TicketController.createCategory);
router.patch("/categories/:categoryId", TicketController.updateCategory);
router.get("/", TicketController.list);
router.post("/", upload.array("attachments", 5), TicketController.create);
router.get("/:id", TicketController.getById);
router.patch("/:id", TicketController.update);
router.post("/:id/assign", TicketController.assign);
router.post("/:id/status", TicketController.changeStatus);
router.post("/:id/comments", upload.array("attachments", 5), TicketController.addComment);
router.post("/:id/rating", TicketController.rate);
router.post("/:id/watchers", TicketController.addWatcher);
router.delete("/:id/watchers/:userId", TicketController.removeWatcher);

export default router;
