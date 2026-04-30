import { Router } from "express";
import {
  generateEstimate,
  getEstimate,
  listEstimates,
  compareWithTender,
  getEstimatePdf
} from "../controllers/estimate.controller.js";

export const estimateRouter = Router();

estimateRouter.post("/generate", generateEstimate);
estimateRouter.get("/", listEstimates);
estimateRouter.get("/:id", getEstimate);
estimateRouter.post("/:id/compare", compareWithTender);
estimateRouter.get("/:id/pdf", getEstimatePdf);
