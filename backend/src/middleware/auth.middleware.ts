import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: "admin" | "analyst" | "viewer";
      };
    }
  }
}

interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: "admin" | "analyst" | "viewer";
}

const normalizeBearerToken = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = normalizeBearerToken(req.headers.authorization);

  if (!token) {
    sendError(res, { code: "UNAUTHORIZED", message: "Missing access token" }, 401);
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
    req.auth = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    sendError(res, { code: "UNAUTHORIZED", message: "Invalid access token" }, 401);
  }
};

export const requireRole = (roles: Array<"admin" | "analyst" | "viewer">) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      sendError(res, { code: "FORBIDDEN", message: "Insufficient permissions" }, 403);
      return;
    }
    next();
  };
};
