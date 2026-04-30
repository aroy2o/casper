import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { SUPPORTED_LANGUAGES } from "../../constants/languages";

const LANGUAGE_KEY = "casper_language";

const readStoredLanguage = (): string => {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (!stored) return "en";
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === stored) ? stored : "en";
};

interface TranslationState {
  currentLanguage: string;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isTranslating: boolean;
}

const initialState: TranslationState = {
  currentLanguage: readStoredLanguage(),
  supportedLanguages: SUPPORTED_LANGUAGES,
  isTranslating: false
};

const translationSlice = createSlice({
  name: "translation",
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.currentLanguage = action.payload;
      localStorage.setItem(LANGUAGE_KEY, action.payload);
    },
    setIsTranslating: (state, action: PayloadAction<boolean>) => {
      state.isTranslating = action.payload;
    }
  }
});

export const { setLanguage, setIsTranslating } = translationSlice.actions;
export default translationSlice.reducer;
