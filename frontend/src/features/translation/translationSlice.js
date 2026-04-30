import { createSlice } from "@reduxjs/toolkit";
import { SUPPORTED_LANGUAGES } from "../../constants/languages";
const LANGUAGE_KEY = "casper_language";
const readStoredLanguage = () => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (!stored)
        return "en";
    return SUPPORTED_LANGUAGES.some((lang) => lang.code === stored) ? stored : "en";
};
const initialState = {
    currentLanguage: readStoredLanguage(),
    supportedLanguages: SUPPORTED_LANGUAGES,
    isTranslating: false
};
const translationSlice = createSlice({
    name: "translation",
    initialState,
    reducers: {
        setLanguage: (state, action) => {
            state.currentLanguage = action.payload;
            localStorage.setItem(LANGUAGE_KEY, action.payload);
        },
        setIsTranslating: (state, action) => {
            state.isTranslating = action.payload;
        }
    }
});
export const { setLanguage, setIsTranslating } = translationSlice.actions;
export default translationSlice.reducer;
