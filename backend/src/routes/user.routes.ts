import { Router } from "express";
import { getProfile, pushSubscribe, updatePreferences } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const userRouter = Router();

userRouter.get("/profile", requireAuth, getProfile);
userRouter.patch("/preferences", requireAuth, updatePreferences);
userRouter.post("/push-subscribe", requireAuth, pushSubscribe);
