import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../utils/apiResponse.js";

export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendError(
        res,
        {
          code: "VALIDATION_ERROR",
          message: result.error.issues.map((issue) => issue.message).join("; ")
        },
        422
      );
      return;
    }
    req.body = result.data;
    next();
  };
};
