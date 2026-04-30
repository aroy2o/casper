import { ProjectType } from "../types/index.js";
import { ITenderCostBreakdown } from "../models/Tender.model.js";

type CostBreakdownInput = {
  totalEstimatedCostINR: number;
  projectType: ProjectType;
  state?: string | null;
  lineItemCount?: number;
};

type SharePlan = {
  materials: number;
  labour: number;
  machinery: number;
  overhead: number;
  contractorProfit: number;
  contingency: number;
  tax: number;
};

const SHARE_PLAN: Record<ProjectType, SharePlan> = {
  road: { materials: 52, labour: 18, machinery: 10, overhead: 7, contractorProfit: 4, contingency: 3, tax: 6 },
  bridge: { materials: 50, labour: 18, machinery: 11, overhead: 7, contractorProfit: 4, contingency: 4, tax: 6 },
  railway: { materials: 48, labour: 18, machinery: 12, overhead: 7, contractorProfit: 5, contingency: 4, tax: 6 },
  building: { materials: 55, labour: 16, machinery: 8, overhead: 7, contractorProfit: 4, contingency: 4, tax: 6 },
  drainage: { materials: 46, labour: 20, machinery: 10, overhead: 7, contractorProfit: 4, contingency: 4, tax: 9 },
  other: { materials: 50, labour: 17, machinery: 10, overhead: 7, contractorProfit: 5, contingency: 5, tax: 6 }
};

const roundCurrency = (value: number): number => Math.max(0, Math.round(value));

const adjustForRounding = (parts: Array<[string, number]>, total: number): ITenderCostBreakdown => {
  const rounded = parts.map(([name, amount]) => [name, roundCurrency(amount)] as const);
  const currentSum = rounded.reduce((sum, [, amount]) => sum + amount, 0);
  const delta = roundCurrency(total) - currentSum;
  const last = rounded[rounded.length - 1];
  if (last) {
    rounded[rounded.length - 1] = [last[0], Math.max(0, last[1] + delta)] as const;
  }

  const result = Object.fromEntries(rounded) as Record<string, number>;
  return {
    materialsCostINR: result.materialsCostINR ?? 0,
    labourCostINR: result.labourCostINR ?? 0,
    machineryCostINR: result.machineryCostINR ?? 0,
    overheadCostINR: result.overheadCostINR ?? 0,
    contractorProfitINR: result.contractorProfitINR ?? 0,
    contingencyINR: result.contingencyINR ?? 0,
    cgstINR: result.cgstINR ?? 0,
    sgstINR: result.sgstINR ?? 0,
    igstINR: result.igstINR ?? 0
  };
};

export const buildTenderCostBreakdown = (input: CostBreakdownInput): ITenderCostBreakdown => {
  const total = Math.max(0, input.totalEstimatedCostINR);
  const basePlan = SHARE_PLAN[input.projectType] ?? SHARE_PLAN.other;
  const lineItemBoost = input.lineItemCount && input.lineItemCount >= 10 ? 2 : 0;
  const materials = basePlan.materials + lineItemBoost;
  const labour = basePlan.labour;
  const machinery = basePlan.machinery;
  const overhead = Math.max(3, basePlan.overhead - lineItemBoost);
  const contractorProfit = basePlan.contractorProfit;
  const contingency = basePlan.contingency;
  const tax = basePlan.tax;

  if ((input.state ?? "").toLowerCase() === "national") {
    return adjustForRounding(
      [
        ["materialsCostINR", total * (materials / 100)],
        ["labourCostINR", total * (labour / 100)],
        ["machineryCostINR", total * (machinery / 100)],
        ["overheadCostINR", total * (overhead / 100)],
        ["contractorProfitINR", total * (contractorProfit / 100)],
        ["contingencyINR", total * (contingency / 100)],
        ["cgstINR", 0],
        ["sgstINR", 0],
        ["igstINR", total * (tax / 100)]
      ],
      total
    );
  }

  return adjustForRounding(
    [
      ["materialsCostINR", total * (materials / 100)],
      ["labourCostINR", total * (labour / 100)],
      ["machineryCostINR", total * (machinery / 100)],
      ["overheadCostINR", total * (overhead / 100)],
      ["contractorProfitINR", total * (contractorProfit / 100)],
      ["contingencyINR", total * (contingency / 100)],
      ["cgstINR", total * (tax / 200)],
      ["sgstINR", total * (tax / 200)],
      ["igstINR", 0]
    ],
    total
  );
};