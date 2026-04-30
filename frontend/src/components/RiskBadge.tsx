interface RiskBadgeProps {
  riskLevel: "critical" | "high" | "medium" | "low" | "clean" | "pending";
}

const colorMap: Record<RiskBadgeProps["riskLevel"], string> = {
  critical: "bg-casper-red/20 text-casper-red border-casper-red/40",
  high: "bg-casper-amber/20 text-casper-amber border-casper-amber/40",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  low: "bg-casper-green/20 text-casper-green border-casper-green/40",
  clean: "bg-teal-500/20 text-teal-400 border-teal-500/40",
  pending: "bg-slate-500/20 text-slate-300 border-slate-500/40"
};

const labelMap: Record<RiskBadgeProps["riskLevel"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  clean: "Clean",
  pending: "Pending"
};

export const RiskBadge = ({ riskLevel }: RiskBadgeProps): JSX.Element => {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorMap[riskLevel]}`}>
      {labelMap[riskLevel]}
    </span>
  );
};
