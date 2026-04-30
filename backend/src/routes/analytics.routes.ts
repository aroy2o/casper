import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getTrends,
  getHeatmap,
  getTopInflated,
  getPredictions,
  getCollusionFlags,
  getVendorRiskScores,
  getVendorRegistry,
  computeVendorRisks,
  getStateList,
  getVendorNetwork
} from "../controllers/analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.get("/states", getStateList);
analyticsRouter.get("/trends", requireAuth, getTrends);
analyticsRouter.get("/heatmap", requireAuth, getHeatmap);
analyticsRouter.get("/top-inflated", requireAuth, getTopInflated);
analyticsRouter.get("/predictions", requireAuth, getPredictions);
analyticsRouter.get("/collusion-flags", requireAuth, getCollusionFlags);
analyticsRouter.get("/vendor-risk-scores", requireAuth, getVendorRiskScores);
analyticsRouter.get("/vendor-registry", requireAuth, getVendorRegistry);
analyticsRouter.post("/compute-vendor-risks", requireAuth, computeVendorRisks);
analyticsRouter.get("/vendor-network", requireAuth, getVendorNetwork);
