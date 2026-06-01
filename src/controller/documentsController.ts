import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import path from "path";
import fs from "fs";

const fetchDocs = async (req: Request, res: Response) => {
  console.log("Fetch Docs");
  try {
    const docs = await prisma.document.findMany();
    return res.json({
      message: "Successfully fetched",
      data: docs,
    });
  } catch (error) {
    console.error("Error fetching Docs:", error);
    return res.status(500).json({
      error: "Error in fetching Docs",
    });
  }
};

const addDocs = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const file = req.file as Express.Multer.File;

    if (!name || !description || !file) {
      return res.status(400).json({
        error: "Name, description and file are required",
      });
    }

    const fileUrl = `/uploads/${file.filename}`;

    const docs = await prisma.document.create({
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
  } catch (error) {
    return res.status(500).json({
      error: "Error in uploading Docs",
    });
  }
};

const deleteDocs = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docId = Number(id);

    if (!Number.isFinite(docId)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const fileName = path.basename(doc.file);
    const filePath = path.join(process.cwd(), "uploads", fileName);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    await prisma.document.delete({
      where: { id: docId },
    });

    return res.json({
      message: "Successfully deleted",
      data: doc,
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({
      error: "Error in deleting document",
    });
  }
};

const downloadDoc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docId = Number(id);

    if (!Number.isFinite(docId)) {
      return res.status(400).json({ error: "Invalid document id" });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const fileName = path.basename(doc.file);
    const filePath = path.join(process.cwd(), "uploads", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    return res.download(filePath, fileName);
  } catch (error) {
    console.error("Error downloading document:", error);
    return res.status(500).json({
      error: "Error in downloading document",
    });
  }
};

export { fetchDocs, addDocs, deleteDocs, downloadDoc };
