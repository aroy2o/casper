import { Request, Response } from "express";
import { benchmarkService } from "../services/benchmark.service.js";
import { env } from "../config/env.js";
import { ollamaClient } from "../services/ollamaClient.service.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

type VoiceProjectType = "road" | "bridge" | "railway" | "building" | "other";
type VoiceRegion = "assam" | "meghalaya" | "arunachal" | "manipur" | "national";
type VoiceQueryType = "cost_estimate" | "price_check" | "fraud_check";

interface VoiceIntent {
  projectType: VoiceProjectType;
  region: VoiceRegion;
  lengthKm: number | null;
  queryType: VoiceQueryType;
}

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
};

const parseIntentFromJson = (raw: string): VoiceIntent | null => {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const projectType =
      data.projectType === "road" ||
      data.projectType === "bridge" ||
      data.projectType === "railway" ||
      data.projectType === "building" ||
      data.projectType === "other"
        ? data.projectType
        : null;
    const region =
      data.region === "assam" ||
      data.region === "meghalaya" ||
      data.region === "arunachal" ||
      data.region === "manipur" ||
      data.region === "national"
        ? data.region
        : null;
    const queryType =
      data.queryType === "cost_estimate" || data.queryType === "price_check" || data.queryType === "fraud_check"
        ? data.queryType
        : null;
    const lengthKm = parseNumber(data.lengthKm);

    if (!projectType || !region || !queryType) {
      return null;
    }

    return {
      projectType,
      region,
      lengthKm,
      queryType
    };
  } catch {
    return null;
  }
};

const fallbackIntent = (transcript: string): VoiceIntent => {
  const lowered = transcript.toLowerCase();
  const lengthMatch = lowered.match(/(\d+(?:\.\d+)?)\s*km/);
  const lengthKm = lengthMatch ? Number(lengthMatch[1]) : null;

  const projectType: VoiceProjectType = lowered.includes("road")
    ? "road"
    : lowered.includes("bridge")
      ? "bridge"
      : lowered.includes("rail")
        ? "railway"
        : lowered.includes("building")
          ? "building"
          : "other";

  const region: VoiceRegion = lowered.includes("meghalaya")
    ? "meghalaya"
    : lowered.includes("arunachal")
      ? "arunachal"
      : lowered.includes("manipur")
        ? "manipur"
        : lowered.includes("national")
          ? "national"
          : "assam";

  const queryType: VoiceQueryType = lowered.includes("fraud")
    ? "fraud_check"
    : lowered.includes("price")
      ? "price_check"
      : "cost_estimate";

  return {
    projectType,
    region,
    lengthKm,
    queryType
  };
};

export const voiceQuery = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const transcript = req.body.transcript as string;
    const mlReachable = req.app.locals.mlServiceReachable as boolean | undefined;

    if (mlReachable === false) {
      return sendError(
        res,
        {
          code: "ML_SERVICE_UNAVAILABLE",
          message: "ML service is currently unavailable. Try again after ML service is up."
        },
        503
      );
    }

    const intentPrompt = [
      "You are a government tender cost analysis assistant for India.",
      `Extract intent from this voice query: \"${transcript}\"`,
      "Respond ONLY with valid JSON in this exact format:",
      "{",
      '  "projectType": "road|bridge|railway|building|other",',
      '  "region": "assam|meghalaya|arunachal|manipur|national",',
      '  "lengthKm": number or null,',
      '  "queryType": "cost_estimate|price_check|fraud_check"',
      "}"
    ].join("\n");

    let intent: VoiceIntent = fallbackIntent(transcript);
    try {
      const generated = await ollamaClient.generate(intentPrompt, {
        model: env.OLLAMA_NLU_MODEL,
        format: "json",
        temperature: 0
      });
      const parsedIntent = parseIntentFromJson(generated);
      if (parsedIntent) {
        intent = parsedIntent;
      }
    } catch {
      intent = fallbackIntent(transcript);
    }

    const result = await benchmarkService.estimate({
      projectType: intent.projectType,
      region: intent.region,
      lengthKm: intent.lengthKm ?? 1,
      year: new Date().getFullYear()
    });

    const breakdownSummary = Object.entries(result.breakdown)
      .map(([key, value]) => `${key}: INR ${value.toFixed(2)}`)
      .join(", ");
    const spokenPrompt = [
      "Given this infrastructure cost estimate for India:",
      `Project: ${intent.projectType}, Region: ${intent.region}, Scale: ${intent.lengthKm ?? 1}km`,
      `Estimated fair cost: INR ${result.estimatedCostINR.toFixed(2)}`,
      `Breakdown: ${breakdownSummary}`,
      "",
      "Write a single spoken sentence answer as if talking to a citizen. Keep it under 30 words. Be specific with numbers."
    ].join("\n");

    let spokenAnswer = `Estimated fair cost is INR ${result.estimatedCostINR.toFixed(2)} for ${intent.projectType} work in ${intent.region}.`;
    try {
      spokenAnswer = await ollamaClient.generate(spokenPrompt, {
        model: env.OLLAMA_NLU_MODEL,
        temperature: 0.2
      });
    } catch {
      spokenAnswer = `Estimated fair cost is INR ${result.estimatedCostINR.toFixed(2)} for ${intent.projectType} work in ${intent.region}.`;
    }

    return sendSuccess(res, { transcript, answer: spokenAnswer.trim(), data: result });
  } catch {
    return sendError(res, { code: "VOICE_QUERY_FAILED", message: "Unable to process voice query" }, 500);
  }
};
