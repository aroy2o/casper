import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../utils/apiResponse.js";

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
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
    req.query = result.data as Request["query"];
    next();
  };
};
