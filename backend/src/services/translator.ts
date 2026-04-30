import axios from "axios";
import { isLibreTranslateReady } from "./libreTranslateService.js";

const LIBRE_URL = "http://127.0.0.1:8002/translate";
const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";
const CACHE_MAX_ENTRIES = 10000;

type CachedEntry = {
  translated: string;
  engine: TranslationEngine;
};

const translationCache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<CachedEntry>>();

const LANGUAGE_PROXY_MAP: Record<string, string> = {
  as: "bn",
  or: "bn",
  bho: "hi",
  mai: "hi",
  doi: "hi",
  kok: "mr",
  sat: "bn"
};

const applyProxy = (lang: string): string => LANGUAGE_PROXY_MAP[lang] ?? lang;

const translateWithLibre = async (text: string, source: string, target: string): Promise<string | null> => {
  try {
    const response = await axios.post(
      LIBRE_URL,
      { q: text, source, target, format: "text" },
      { timeout: 5000 }
    );
    const translated = (response.data as { translatedText?: string })?.translatedText;
    return typeof translated === "string" && translated.length > 0 ? translated : null;
  } catch {
    return null;
  }
};

const translateWithGoogle = async (text: string, source: string, target: string): Promise<string | null> => {
  try {
    const response = await axios.get(GOOGLE_URL, {
      timeout: 8000,
      params: { client: "gtx", sl: source, tl: target, dt: "t", q: text }
    });
    const result = response.data as unknown;
    if (!Array.isArray(result) || !Array.isArray(result[0])) return null;
    const joined = (result[0] as Array<[string]>).map((x) => x[0]).join("");
    return joined.length > 0 ? joined : null;
  } catch {
    return null;
  }
};

export type TranslationEngine = "libretranslate" | "google" | "fallback";

export interface TranslationResult {
  translated: string;
  engine: TranslationEngine;
  targetLang: string;
}

export const translate = async (
  text: string,
  targetLang: string,
  sourceLang = "en"
): Promise<TranslationResult> => {
  const cleanText = text.trim();
  if (!cleanText) {
    return { translated: text, engine: "fallback", targetLang };
  }

  const target = applyProxy(targetLang.toLowerCase());
  const source = applyProxy(sourceLang.toLowerCase());

  if (target === source) {
    return { translated: text, engine: "fallback", targetLang };
  }

  const cacheKey = `${source}:${target}:${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) {
    // Refresh LRU ordering.
    translationCache.delete(cacheKey);
    translationCache.set(cacheKey, cached);
    return { translated: cached.translated, engine: cached.engine, targetLang };
  }

  const existingInFlight = inFlight.get(cacheKey);
  if (existingInFlight) {
    const shared = await existingInFlight;
    return { translated: shared.translated, engine: shared.engine, targetLang };
  }

  const job = (async (): Promise<CachedEntry> => {
    if (isLibreTranslateReady()) {
      const localTranslated = await translateWithLibre(cleanText, source, target);
      if (localTranslated) {
        return { translated: localTranslated, engine: "libretranslate" };
      }
    }

    const googleTranslated = await translateWithGoogle(cleanText, source, target);
    if (googleTranslated) {
      return { translated: googleTranslated, engine: "google" };
    }

    return { translated: text, engine: "fallback" };
  })();

  inFlight.set(cacheKey, job);
  try {
    const result = await job;
    translationCache.set(cacheKey, result);
    if (translationCache.size > CACHE_MAX_ENTRIES) {
      const oldest = translationCache.keys().next().value;
      if (oldest) translationCache.delete(oldest);
    }
    return { translated: result.translated, engine: result.engine, targetLang };
  } finally {
    inFlight.delete(cacheKey);
  }
};
