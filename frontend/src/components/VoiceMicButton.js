import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { sendVoiceQuery, setTranscript, speakAnswer, startListening, stopListening } from "../features/voice/voiceSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { showToast } from "../utils/toast";
export const VoiceMicButton = () => {
    const dispatch = useAppDispatch();
    const { isListening, transcript, answer, status, error } = useAppSelector((state) => state.voice);
    const [toastVisible, setToastVisible] = useState(false);
    useEffect(() => {
        const onTranscript = (event) => {
            const custom = event;
            const value = custom.detail ?? "";
            dispatch(setTranscript(value));
            if (value.trim().length > 0) {
                void dispatch(sendVoiceQuery(value)).then((result) => {
                    if (sendVoiceQuery.fulfilled.match(result)) {
                        dispatch(speakAnswer(result.payload.answer));
                        showToast("info", result.payload.answer);
                        setToastVisible(true);
                    }
                });
            }
        };
        const onEnd = () => {
            dispatch(stopListening());
        };
        const onError = (event) => {
            const custom = event;
            showToast("error", custom.detail ?? "Voice capture failed");
            dispatch(stopListening());
        };
        window.addEventListener("casper-voice-transcript", onTranscript);
        window.addEventListener("casper-voice-end", onEnd);
        window.addEventListener("casper-voice-error", onError);
        return () => {
            window.removeEventListener("casper-voice-transcript", onTranscript);
            window.removeEventListener("casper-voice-end", onEnd);
            window.removeEventListener("casper-voice-error", onError);
        };
    }, [dispatch]);
    useEffect(() => {
        if (toastVisible) {
            const timer = window.setTimeout(() => setToastVisible(false), 8000);
            return () => window.clearTimeout(timer);
        }
        return undefined;
    }, [toastVisible]);
    const buttonClasses = useMemo(() => {
        return [
            "relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow",
            "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            isListening ? "mic-pulse border-casper-green text-casper-green" : "hover:border-casper-blue"
        ].join(" ");
    }, [isListening]);
    return (_jsxs("div", { className: "relative flex flex-col items-center gap-2", children: [transcript ? (_jsx("div", { className: "max-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow dark:border-slate-700 dark:bg-slate-900", children: transcript })) : null, _jsx("button", { type: "button", onClick: () => dispatch(isListening ? stopListening() : startListening()), className: buttonClasses, "aria-label": "Voice Query", children: _jsxs("svg", { viewBox: "0 0 24 24", className: "h-5 w-5 fill-current", "aria-hidden": true, children: [_jsx("path", { d: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" }), _jsx("path", { d: "M18 11a1 1 0 1 0-2 0 4 4 0 1 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.09A6 6 0 0 0 18 11Z" })] }) }), toastVisible && answer ? (_jsx("div", { className: "absolute -top-24 left-1/2 z-20 w-72 -translate-x-1/2 rounded-lg border border-casper-blue/40 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg", children: answer })) : null, status === "loading" ? _jsx("span", { className: "text-[11px] text-slate-500", children: "Analyzing..." }) : null, error ? _jsx("span", { className: "text-[11px] text-casper-red", children: error }) : null] }));
};
