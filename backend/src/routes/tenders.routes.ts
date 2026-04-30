import { Router } from "express";
import {
	compareTenders,
	deleteTender,
	exportTenderPdf,
	getTenderById,
	listTenders,
	reauditTender,
	uploadTender,
	upsertTenderBoq
} from "../controllers/tenders.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { uploadPdf } from "../middleware/upload.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { validateQuery } from "../middleware/validateQuery.middleware.js";
import { compareQuerySchema, tenderQuerySchema, uploadTenderSchema, upsertTenderBoqSchema } from "../schemas/tender.schema.js";

export const tendersRouter = Router();

tendersRouter.post("/upload", requireAuth, uploadPdf.single("file"), validate(uploadTenderSchema), uploadTender);
tendersRouter.get("/compare", requireAuth, validateQuery(compareQuerySchema), compareTenders);
tendersRouter.get("/", requireAuth, validateQuery(tenderQuerySchema), listTenders);
tendersRouter.post("/:id/boq", requireAuth, validate(upsertTenderBoqSchema), upsertTenderBoq);
tendersRouter.post("/:id/reaudit", requireAuth, reauditTender);
tendersRouter.get("/:id/export-pdf", requireAuth, exportTenderPdf);
tendersRouter.get("/:id", requireAuth, getTenderById);
tendersRouter.delete("/:id", requireAuth, requireRole(["admin"]), deleteTender);
