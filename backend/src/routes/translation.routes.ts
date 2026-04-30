import { Router } from "express";
import { getTranslationStatus, translateBatch, translateText } from "../controllers/translation.controller.js";

export const translationRouter = Router();

translationRouter.post("/", translateText);
translationRouter.post("/batch", translateBatch);
translationRouter.get("/status", getTranslationStatus);
