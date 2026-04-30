import { Request, Response } from "express";
import { AlertModel } from "../models/Alert.model.js";
import { isValidObjectId } from "../utils/objectId.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export const streamAlerts = async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const userId = req.auth?.userId;
  if (!userId) {
    res.write("event: error\ndata: unauthorized\n\n");
    res.end();
    return;
  }

  const send = async (): Promise<void> => {
    const rows = await AlertModel.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.write(`data: ${JSON.stringify(rows)}\n\n`);
  };

  await send();
  const timer = setInterval(() => {
    send().catch((err) => {
      console.error("[streamAlerts] send failed:", err);
      clearInterval(timer);
      res.end();
    });
  }, 10000);

  req.on("close", () => {
    clearInterval(timer);
    res.end();
  });
};

export const markAlertRead = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const alertId = req.params.id;
    if (!alertId || !isValidObjectId(alertId)) {
      return sendError(res, { code: "INVALID_ID", message: "Invalid ID format" }, 400);
    }
    const alert = await AlertModel.findOneAndUpdate(
      { _id: alertId, userId: req.auth?.userId },
      { isRead: true },
      { new: true }
    ).lean();

    if (!alert) {
      return sendError(res, { code: "NOT_FOUND", message: "Alert not found" }, 404);
    }

    return sendSuccess(res, alert);
  } catch {
    return sendError(res, { code: "ALERT_UPDATE_FAILED", message: "Unable to mark alert" }, 500);
  }
};

export const markAllAlertsRead = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    await AlertModel.updateMany({ userId: req.auth?.userId, isRead: false }, { isRead: true });
    return sendSuccess(res, { updated: true });
  } catch {
    return sendError(res, { code: "ALERTS_UPDATE_FAILED", message: "Unable to mark alerts" }, 500);
  }
};
