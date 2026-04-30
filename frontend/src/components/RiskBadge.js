import { jsx as _jsx } from "react/jsx-runtime";
const colorMap = {
    critical: "bg-casper-red/20 text-casper-red border-casper-red/40",
    high: "bg-casper-amber/20 text-casper-amber border-casper-amber/40",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    low: "bg-casper-green/20 text-casper-green border-casper-green/40",
    clean: "bg-teal-500/20 text-teal-400 border-teal-500/40",
    pending: "bg-slate-500/20 text-slate-300 border-slate-500/40"
};
const labelMap = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    clean: "Clean",
    pending: "Pending"
};
export const RiskBadge = ({ riskLevel }) => {
    return (_jsx("span", { className: `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorMap[riskLevel]}`, children: labelMap[riskLevel] }));
};
