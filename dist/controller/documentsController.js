"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDoc = exports.deleteDocs = exports.addDocs = exports.fetchDocs = void 0;
const prisma_1 = require("../lib/prisma");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fetchDocs = async (req, res) => {
    console.log("Fetch Docs");
    try {
        const docs = await prisma_1.prisma.document.findMany();
        return res.json({
            message: "Successfully fetched",
            data: docs,
        });
    }
    catch (error) {
        console.error("Error fetching Docs:", error);
        return res.status(500).json({
            error: "Error in fetching Docs",
        });
    }
};
exports.fetchDocs = fetchDocs;
const addDocs = async (req, res) => {
    try {
        const { name, description } = req.body;
        const file = req.file;
        if (!name || !description || !file) {
            return res.status(400).json({
                error: "Name, description and file are required",
            });
        }
        const fileUrl = `/uploads/${file.filename}`;
        const docs = await prisma_1.prisma.document.create({
            data: {
                name,
                description,
                file: fileUrl,
            },
        });
        return res.json({
            message: "Successfully uploaded",
            data: docs,
        });
    }
    catch (error) {
        return res.status(500).json({
            error: "Error in uploading Docs",
        });
    }
};
exports.addDocs = addDocs;
const deleteDocs = async (req, res) => {
    try {
        const { id } = req.params;
        const docId = Number(id);
        if (!Number.isFinite(docId)) {
            return res.status(400).json({ error: "Invalid document id" });
        }
        const doc = await prisma_1.prisma.document.findUnique({
            where: { id: docId },
        });
        if (!doc) {
            return res.status(404).json({ error: "Document not found" });
        }
        const fileName = path_1.default.basename(doc.file);
        const filePath = path_1.default.join(process.cwd(), "uploads", fileName);
        if (fs_1.default.existsSync(filePath)) {
            await fs_1.default.promises.unlink(filePath);
        }
        await prisma_1.prisma.document.delete({
            where: { id: docId },
        });
        return res.json({
            message: "Successfully deleted",
            data: doc,
        });
    }
    catch (error) {
        console.error("Error deleting document:", error);
        return res.status(500).json({
            error: "Error in deleting document",
        });
    }
};
exports.deleteDocs = deleteDocs;
const downloadDoc = async (req, res) => {
    try {
        const { id } = req.params;
        const docId = Number(id);
        if (!Number.isFinite(docId)) {
            return res.status(400).json({ error: "Invalid document id" });
        }
        const doc = await prisma_1.prisma.document.findUnique({
            where: { id: docId },
        });
        if (!doc) {
            return res.status(404).json({ error: "Document not found" });
        }
        const fileName = path_1.default.basename(doc.file);
        const filePath = path_1.default.join(process.cwd(), "uploads", fileName);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found on server" });
        }
        return res.download(filePath, fileName);
    }
    catch (error) {
        console.error("Error downloading document:", error);
        return res.status(500).json({
            error: "Error in downloading document",
        });
    }
};
exports.downloadDoc = downloadDoc;
