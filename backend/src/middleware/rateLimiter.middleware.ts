import { NextFunction, Request, Response } from "express";

type LimitRule = { windowMs: number; max: number };
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const generalRule: LimitRule = { windowMs: 60_000, max: 100 };
const uploadRule: LimitRule = { windowMs: 60_000, max: 5 };
const voiceRule: LimitRule = { windowMs: 60_000, max: 20 };

function getRule(req: Request): LimitRule {
  if (req.method === "POST" && req.path === "/api/tenders/upload") {
    return uploadRule;
  }
  if (req.method === "POST" && req.path === "/api/voice/query") {
    return voiceRule;
  }
  return generalRule;
}

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0];
    if (first) return first.trim();
  }
  return req.ip || "unknown";
}

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const rule = getRule(req);
  const ip = getClientIp(req);
  const key = `${req.method}:${req.path}:${ip}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs });
    next();
    return;
  }

  if (existing.count >= rule.max) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please retry later.",
        retryAfter
      }
    });
    return;
  }

  existing.count += 1;
  store.set(key, existing);
  next();
};
