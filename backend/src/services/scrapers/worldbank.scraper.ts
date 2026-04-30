import axios from "axios";
import { BenchmarkModel, type BenchmarkProjectType } from "../../models/Benchmark.model.js";
import { logger } from "./shared.js";

const client = axios.create({ timeout: 20_000 });

function classifyProjectType(text: string): BenchmarkProjectType {
  const value = text.toLowerCase();
  if (value.includes("transport") || value.includes("road") || value.includes("highway")) return "road";
  if (value.includes("bridge")) return "bridge";
  if (value.includes("building") || value.includes("urban") || value.includes("municipal")) return "building";
  return "other";
}

function inferRegion(text: string): string {
  const value = text.toLowerCase();
  if (value.includes("assam") || value.includes("guwahati")) return "assam";
  if (value.includes("meghalaya") || value.includes("shillong")) return "meghalaya";
  if (value.includes("arunachal") || value.includes("itanagar")) return "arunachal";
  if (value.includes("manipur") || value.includes("imphal")) return "manipur";
  return "national";
}

function parseApprovalYear(value: string | undefined): number {
  if (!value) return new Date().getFullYear();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  const match = value.match(/(\d{4})/);
  if (match?.[1]) return Number(match[1]);
  return new Date().getFullYear();
}

function parseLengthKm(text: string | undefined): number | null {
  if (!text) return null;
  const normalized = text.replace(/,/g, " ").replace(/\s+/g, " ").toLowerCase();
  const km = normalized.match(/(\d+(?:\.\d+)?)\s*(?:km|kilomet(?:er|re)s?)/);
  if (km?.[1]) {
    const value = Number(km[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*m(?:etre|eter)s?\b/);
  if (m?.[1]) {
    const value = Number(m[1]);
    return Number.isFinite(value) && value > 0 ? value / 1000 : null;
  }
  return null;
}

export const runWorldBankScraper = async (): Promise<number> => {
  logger.info("[WORLDBANK] fetch_start");
  const { data } = await client.get<{ projects?: Record<string, Record<string, string>> }>(
    "https://search.worldbank.org/api/v2/projects?format=json&countrycode=IN&qterm=northeast+india+infrastructure&fl=id,name,totalamt,boardapprovaldate,status,sector,lendinginstr,project_abstract&rows=50&os=0"
  );
  const projects = Object.values(data.projects ?? {});
  let count = 0;

  for (const project of projects) {
    const amountUsd = Number(project.totalamt ?? 0);
    if (amountUsd <= 0 || !project.id || !project.name) continue;
    const costINR = amountUsd * 83;
    const projectType = classifyProjectType(`${project.sector ?? ""} ${project.name}`);
    const region = inferRegion(`${project.name} ${project.project_abstract ?? ""}`);
    const approvalYear = parseApprovalYear(project.boardapprovaldate);
    const lengthKm = parseLengthKm(project.project_abstract);
    const costPerKmINR = lengthKm && lengthKm > 0 ? costINR / lengthKm : null;

    await BenchmarkModel.findOneAndUpdate(
      { projectId: String(project.id) },
      {
        projectId: String(project.id),
        projectName: String(project.name),
        projectType,
        region,
        totalCostINR: costINR,
        lengthKm,
        costPerKmINR,
        approvalYear,
        source: "worldbank",
        fetchedAt: new Date()
      },
      { upsert: true, new: true }
    );
    count += 1;
  }

  logger.info(`[WORLDBANK] fetch_done upserted=${count}`);
  return count;
};
