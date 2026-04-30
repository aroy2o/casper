import { Request, Response } from "express";
import { EstimateModel } from "../models/Estimate.model.js";
import {
  generateEstimateSchema,
  compareEstimateSchema,
  listEstimatesQuerySchema
} from "../schemas/estimate.schema.js";
import {
  generateAIEstimate,
  fetchMlEstimate,
  compareTenderQuote,
  generateEstimatePdf,
  hashInputs
} from "../services/estimateAI.service.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { isValidObjectId } from "../utils/objectId.js";

export const generateEstimate = async (req: Request, res: Response): Promise<Response | void> => {
  const parsed = generateEstimateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      { code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join("; ") },
      422
    );
  }

  const data = parsed.data;
  const inputs: Record<string, unknown> = data;
  const inputsHash = hashInputs(inputs);

  try {
    // Attempt ML prediction
    const { ml_estimate_cr, ml_model_version } = await fetchMlEstimate(data.project_type, inputs);

    // Call AI for structured estimate
    const { result: aiResult, modelUsed } = await generateAIEstimate(inputs, ml_estimate_cr);

    const estimate = await EstimateModel.create({
      project_name: data.project_name,
      district: data.district,
      state: data.state,
      financial_year: data.financial_year,
      project_type: data.project_type,
      inputs,
      inputs_hash: inputsHash,
      ml_estimate_cr,
      ml_model_version,
      ai_result: aiResult,
      total_cost_cr: aiResult.total_cost_cr,
      confidence_level: aiResult.confidence_level,
      confidence_pct: aiResult.confidence_pct,
      claude_model_used: modelUsed,
      user_id: (req as Request & { userId?: string }).userId ?? null,
      tender_comparison: null
    });

    return sendSuccess(res, estimate, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Estimate generation failed";
    return sendError(res, { code: "ESTIMATE_FAILED", message }, 500);
  }
};

export const getEstimate = async (req: Request, res: Response): Promise<Response | void> => {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    return sendError(res, { code: "INVALID_ID", message: "Invalid estimate ID" }, 400);
  }
  try {
    const estimate = await EstimateModel.findById(id).lean();
    if (!estimate) {
      return sendError(res, { code: "NOT_FOUND", message: "Estimate not found" }, 404);
    }
    return sendSuccess(res, estimate);
  } catch {
    return sendError(res, { code: "FETCH_FAILED", message: "Failed to fetch estimate" }, 500);
  }
};

export const listEstimates = async (req: Request, res: Response): Promise<Response | void> => {
  const parsed = listEstimatesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(
      res,
      { code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join("; ") },
      422
    );
  }

  const { project_type, state, date_from, date_to, page, limit } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (project_type) filter.project_type = project_type;
  if (state) filter.state = { $regex: new RegExp(state, "i") };
  if (date_from || date_to) {
    const dateFilter: Record<string, Date> = {};
    if (date_from) dateFilter.$gte = new Date(date_from);
    if (date_to) dateFilter.$lte = new Date(date_to);
    filter.created_at = dateFilter;
  }

  try {
    const [estimates, total] = await Promise.all([
      EstimateModel.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-inputs -ai_result.comparable_projects")
        .lean(),
      EstimateModel.countDocuments(filter)
    ]);
    return sendSuccess(res, { estimates, total, page, limit, pages: Math.ceil(total / limit) });
  } catch {
    return sendError(res, { code: "FETCH_FAILED", message: "Failed to list estimates" }, 500);
  }
};

export const compareWithTender = async (req: Request, res: Response): Promise<Response | void> => {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    return sendError(res, { code: "INVALID_ID", message: "Invalid estimate ID" }, 400);
  }

  const parsed = compareEstimateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      { code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join("; ") },
      422
    );
  }

  try {
    const estimate = await EstimateModel.findById(id);
    if (!estimate) {
      return sendError(res, { code: "NOT_FOUND", message: "Estimate not found" }, 404);
    }

    const compareResult = await compareTenderQuote(
      estimate.ai_result,
      parsed.data.tender_quoted_cr,
      estimate.project_type
    );

    estimate.tender_comparison = compareResult;
    await estimate.save();

    return sendSuccess(res, compareResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Comparison failed";
    return sendError(res, { code: "COMPARE_FAILED", message }, 500);
  }
};

export const getEstimatePdf = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    sendError(res, { code: "INVALID_ID", message: "Invalid estimate ID" }, 400);
    return;
  }

  try {
    const estimate = await EstimateModel.findById(id).lean();
    if (!estimate) {
      sendError(res, { code: "NOT_FOUND", message: "Estimate not found" }, 404);
      return;
    }

    const pdfBuffer = await generateEstimatePdf({
      project_name: estimate.project_name,
      project_type: estimate.project_type,
      state: estimate.state,
      district: estimate.district,
      financial_year: estimate.financial_year,
      total_cost_cr: estimate.total_cost_cr,
      confidence_level: estimate.confidence_level,
      confidence_pct: estimate.confidence_pct,
      ai_result: estimate.ai_result,
      ml_estimate_cr: estimate.ml_estimate_cr,
      created_at: estimate.created_at
    });

    const safeName = estimate.project_name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CASPER_Estimate_${safeName}.pdf"`,
      "Content-Length": String(pdfBuffer.length)
    });
    res.end(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    sendError(res, { code: "PDF_FAILED", message }, 500);
  }
};
