import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setLanguage } from "../features/translation/translationSlice";
export const LanguageSwitcher = () => {
    const dispatch = useAppDispatch();
    const { currentLanguage, supportedLanguages } = useAppSelector((state) => state.translation);
    return (_jsxs("label", { "data-no-translate": "true", className: "flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-2 py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900", children: [_jsx("span", { className: "text-slate-600 dark:text-slate-300", children: "Lang" }), _jsx("select", { value: currentLanguage, onChange: (event) => {
                    dispatch(setLanguage(event.target.value));
                    window.dispatchEvent(new Event("casper-language-changed"));
                }, className: "rounded-md border border-transparent bg-transparent px-1 text-sm text-slate-800 outline-none focus:border-casper-blue dark:bg-slate-900 dark:text-slate-100", children: supportedLanguages.map((lang) => (_jsxs("option", { value: lang.code, className: "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100", children: [lang.nativeName, " (", lang.code, ")"] }, lang.code))) })] }));
};
