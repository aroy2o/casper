import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
const prettifySource = (source, sourceURL) => {
    if (source && source.trim().length > 0) {
        return source.replaceAll("_", " ");
    }
    if (sourceURL && sourceURL.length > 0) {
        try {
            const url = new URL(sourceURL);
            return url.hostname.replace("www.", "");
        }
        catch {
            return "external source";
        }
    }
    return "source unavailable";
};
const formatFetchedAt = (date) => {
    if (!date)
        return null;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed.toLocaleString();
};
export const SourceRef = ({ source, sourceURL, fetchedAt, className }) => {
    const sourceLabel = prettifySource(source, sourceURL);
    const fetched = formatFetchedAt(fetchedAt);
    return (_jsxs("div", { className: `inline-flex flex-wrap items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className ?? ""}`, children: [_jsxs("span", { children: ["Fetched from ", sourceLabel] }), sourceURL ? (_jsx("a", { href: sourceURL, target: "_blank", rel: "noreferrer", className: "text-casper-blue hover:underline", children: "reference" })) : null, fetched ? _jsxs("span", { children: ["\u2022 ", fetched] }) : null] }));
};
