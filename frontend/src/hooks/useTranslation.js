import { useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setIsTranslating } from "../features/translation/translationSlice";
export const useTranslation = () => {
    const dispatch = useAppDispatch();
    const currentLanguage = useAppSelector((state) => state.translation.currentLanguage);
    const isTranslating = useAppSelector((state) => state.translation.isTranslating);
    const cacheRef = useRef(new Map());
    const t = useCallback(async (text, sourceLang = "en") => {
        if (!text || currentLanguage === "en")
            return text;
        const key = `${sourceLang}:${currentLanguage}:${text}`;
        const cached = cacheRef.current.get(key);
        if (cached)
            return cached;
        dispatch(setIsTranslating(true));
        try {
            const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
            const response = await fetch(`${apiBase}/api/translate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    sourceLang,
                    targetLang: currentLanguage
                })
            });
            const payload = (await response.json());
            const translated = payload.translated ?? text;
            cacheRef.current.set(key, translated);
            return translated;
        }
        catch {
            return text;
        }
        finally {
            dispatch(setIsTranslating(false));
        }
    }, [currentLanguage, dispatch]);
    return { t, currentLanguage, isTranslating };
};
