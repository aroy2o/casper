import { Response } from "express";
import { ApiError } from "../types/index.js";

export const sendSuccess = <T>(res: Response, data: T, status = 200): Response => {
  return res.status(status).json({ success: true, data });
};

export const sendError = (res: Response, error: ApiError, status = 400): Response => {
  return res.status(status).json({ success: false, error });
};
