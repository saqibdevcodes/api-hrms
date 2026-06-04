import { Router } from "express";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import {
  fetchDocs,
  addDocs as uploadDocs,
  deleteDocs,
  downloadDoc,
} from "../controller/documentsController";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF/DOC/DOCX allowed"));
  },
});

router.get("/", authenticate, fetchDocs);
router.get("/download/:id", authenticate, downloadDoc);
router.post("/", authenticate, hrAndAdmin, upload.single("file"), uploadDocs);
router.delete("/:id", authenticate, hrAndAdmin, deleteDocs);

export default router;
