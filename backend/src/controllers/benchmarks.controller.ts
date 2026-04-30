import { Request, Response } from "express";
import { benchmarkService } from "../services/benchmark.service.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export const getBenchmarks = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const result = await benchmarkService.estimate({
      projectType: req.query.type as string,
      region: req.query.region as string,
      lengthKm: Number(req.query.lengthKm),
      year: Number(req.query.year)
    });

    return sendSuccess(res, result);
  } catch {
    return sendError(res, { code: "BENCHMARK_FAILED", message: "Unable to generate benchmark" }, 500);
  }
};
