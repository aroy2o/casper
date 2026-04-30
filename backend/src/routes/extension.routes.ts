import { Router } from "express";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { auditPage, auditPdfUrl, getExtensionAudits, getExtensionAuditById } from "../controllers/extension.controller.js";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

// Multer for PDF uploads — disk storage so mlClient.parsePdf gets a real path
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    filename: (_req, _file, cb) => cb(null, `ext-pdf-${Date.now()}.pdf`)
  }),
  limits: { fileSize: 15 * 1024 * 1024 }
});

export const extensionRouter = Router();

// Extension auth middleware - accepts valid JWT tokens
const extensionAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization?.trim();
  const token = header ? (header.startsWith("Bearer ") ? header.slice(7).trim() : header) : undefined;

  if (!token) {
    return sendError(res, { code: "UNAUTHORIZED", message: "Missing access token" }, 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; role: string };
    req.auth = { userId: payload.userId, role: payload.role as "admin" | "analyst" | "viewer" };
    next();
  } catch {
    return sendError(res, { code: "UNAUTHORIZED", message: "Invalid access token" }, 401);
  }
};

extensionRouter.post("/audit", extensionAuth, auditPage);
extensionRouter.post("/audit-pdf", extensionAuth, pdfUpload.single("pdf"), auditPdfUrl);
extensionRouter.get("/audits", extensionAuth, getExtensionAudits);
extensionRouter.get("/audits/:auditId", extensionAuth, getExtensionAuditById);
