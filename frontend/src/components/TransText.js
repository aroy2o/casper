import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
export const TransText = ({ text }) => {
    const { t, currentLanguage } = useTranslation();
    const [value, setValue] = useState(text);
    useEffect(() => {
        let mounted = true;
        void t(text).then((next) => {
            if (mounted)
                setValue(next);
        });
        return () => {
            mounted = false;
        };
    }, [text, t, currentLanguage]);
    return _jsx(_Fragment, { children: value });
};
