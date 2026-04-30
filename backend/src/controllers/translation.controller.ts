import type { Request, Response } from "express";
import { SUPPORTED_LANGUAGES } from "../constants/languages.js";
import { isLibreTranslateReady } from "../services/libreTranslateService.js";
import { translate } from "../services/translator.js";

export const translateText = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { text?: string; targetLang?: string; sourceLang?: string };
  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "en";
  const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : "en";

  const result = await translate(text, targetLang, sourceLang);
  res.status(200).json(result);
};

export const translateBatch = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { texts?: string[]; targetLang?: string; sourceLang?: string };
  const texts = Array.isArray(body.texts) ? body.texts.filter((v): v is string => typeof v === "string") : [];
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "en";
  const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : "en";

  const translations: string[] = [];
  let engine = "fallback";
  for (const text of texts) {
    const result = await translate(text, targetLang, sourceLang);
    translations.push(result.translated);
    if (engine === "fallback" && result.engine !== "fallback") {
      engine = result.engine;
    }
  }

  res.status(200).json({ translations, engine });
};

export const getTranslationStatus = (_req: Request, res: Response): void => {
  res.status(200).json({
    libretranslate: isLibreTranslateReady(),
    supportedLanguages: SUPPORTED_LANGUAGES.map((lang) => lang.code)
  });
};
