import { Request, Response } from "express";
import { UserModel } from "../models/User.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export const getProfile = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = await UserModel.findById(req.auth?.userId).lean();
    if (!user) {
      return sendError(res, { code: "NOT_FOUND", message: "User not found" }, 404);
    }

    return sendSuccess(res, {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      preferences: user.preferences
    });
  } catch {
    return sendError(res, { code: "PROFILE_FETCH_FAILED", message: "Unable to fetch profile" }, 500);
  }
};

export const updatePreferences = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.auth?.userId,
      { $set: { preferences: req.body } },
      { new: true }
    ).lean();

    if (!user) {
      return sendError(res, { code: "NOT_FOUND", message: "User not found" }, 404);
    }

    return sendSuccess(res, user.preferences);
  } catch {
    return sendError(res, { code: "PREFERENCES_UPDATE_FAILED", message: "Unable to update preferences" }, 500);
  }
};

export const pushSubscribe = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.auth?.userId,
      { $set: { "preferences.pushSubscription": req.body } },
      { new: true }
    ).lean();

    if (!user) {
      return sendError(res, { code: "NOT_FOUND", message: "User not found" }, 404);
    }

    return sendSuccess(res, { subscribed: true });
  } catch {
    return sendError(res, { code: "PUSH_SUBSCRIBE_FAILED", message: "Unable to save push subscription" }, 500);
  }
};
