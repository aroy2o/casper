import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { logSecurityEvent } from "../services/auditLog.service.js";

const signAccessToken = (payload: { userId: string; role: "admin" | "analyst" | "viewer" }): string => {
  const accessExpires = env.JWT_ACCESS_EXPIRES as NonNullable<jwt.SignOptions["expiresIn"]>;
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessExpires });
};

const signRefreshToken = (payload: { userId: string; role: "admin" | "analyst" | "viewer" }): string => {
  const refreshExpires = env.JWT_REFRESH_EXPIRES as NonNullable<jwt.SignOptions["expiresIn"]>;
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: refreshExpires
  });
};

export const register = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { name, email, password, organization, role } = req.body as {
      name: string;
      email: string;
      password: string;
      organization: string;
      role?: "admin" | "analyst" | "viewer";
    };

    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return sendError(res, { code: "EMAIL_EXISTS", message: "Email already registered" }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ name, email, passwordHash, organization, role: role ?? "viewer" });

    const payload = { userId: user._id.toString(), role: user.role };
    return sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        },
        tokens: {
          accessToken: signAccessToken(payload),
          refreshToken: signRefreshToken(payload)
        }
      },
      201
    );
  } catch {
    return sendError(res, { code: "REGISTER_FAILED", message: "Unable to register user" }, 500);
  }
};

export const login = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await UserModel.findOne({ email });

    if (!user) {
      void logSecurityEvent({ action: "login_failed", req, userEmail: email, outcome: "failure", metadata: { reason: "user_not_found" } });
      return sendError(res, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      void logSecurityEvent({ action: "login_failed", req, userId: user._id.toString(), userEmail: email, outcome: "failure", metadata: { reason: "wrong_password" } });
      return sendError(res, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401);
    }

    void logSecurityEvent({ action: "login_success", req, userId: user._id.toString(), userEmail: email, userRole: user.role, outcome: "success" });
    const payload = { userId: user._id.toString(), role: user.role };
    return sendSuccess(res, {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      },
      tokens: {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload)
      }
    });
  } catch {
    return sendError(res, { code: "LOGIN_FAILED", message: "Unable to login" }, 500);
  }
};

export const refresh = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return sendError(res, { code: "MISSING_TOKEN", message: "Refresh token required" }, 400);
    }

    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string; role: "admin" | "analyst" | "viewer" };
    return sendSuccess(res, {
      accessToken: signAccessToken({ userId: payload.userId, role: payload.role })
    });
  } catch {
    return sendError(res, { code: "INVALID_TOKEN", message: "Refresh token invalid" }, 401);
  }
};

export const logout = async (_req: Request, res: Response): Promise<Response> => {
  return sendSuccess(res, { message: "Logged out" });
};
