import { TenderStatus } from "../types/index.js";

type TenderStatusInput = {
  totalEstimatedCostINR?: number | null;
  lineItemCount?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
};

export const hasTenderCostEvidence = (input: Pick<TenderStatusInput, "totalEstimatedCostINR" | "lineItemCount">): boolean => {
  return Number(input.totalEstimatedCostINR ?? 0) > 0 || Number(input.lineItemCount ?? 0) > 0;
};

export const determineTenderStatus = (input: TenderStatusInput): TenderStatus => {
  const hasCostEvidence = hasTenderCostEvidence(input);
  if (!hasCostEvidence) return "insufficient_data";
  if ((input.lineItemCount ?? 0) > 0 && (input.riskLevel === "high" || input.riskLevel === "critical")) {
    return "flagged";
  }
  return "clean";
};