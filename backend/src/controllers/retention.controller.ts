import { Request, Response } from "express";
import { TenderModel } from "../models/Tender.model.js";
import { RetentionPolicyModel } from "../models/RetentionPolicy.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

const getOrCreatePolicy = async () => {
  let policy = await RetentionPolicyModel.findOne();
  if (!policy) {
    policy = await RetentionPolicyModel.create({});
  }
  return policy;
};

export const getRetentionPolicy = async (_req: Request, res: Response): Promise<Response | void> => {
  try {
    const policy = await getOrCreatePolicy();
    const archivedCount = await TenderModel.countDocuments({ isArchived: true });
    const activeCount = await TenderModel.countDocuments({ isArchived: { $ne: true } });
    return sendSuccess(res, { policy, stats: { archivedCount, activeCount } });
  } catch {
    return sendError(res, { code: "RETENTION_FETCH_FAILED", message: "Unable to fetch retention policy" }, 500);
  }
};

export const updateRetentionPolicy = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const {
      archiveAfterDays,
      deleteAfterDays,
      autoArchiveEnabled,
      autoDeleteEnabled
    } = req.body as {
      archiveAfterDays?: number;
      deleteAfterDays?: number | null;
      autoArchiveEnabled?: boolean;
      autoDeleteEnabled?: boolean;
    };

    const policy = await getOrCreatePolicy();

    if (archiveAfterDays !== undefined) {
      if (archiveAfterDays < 30) {
        return sendError(res, { code: "INVALID_POLICY", message: "archiveAfterDays must be at least 30" }, 400);
      }
      policy.archiveAfterDays = archiveAfterDays;
      policy.retentionDays = archiveAfterDays;
    }
    if (deleteAfterDays !== undefined) policy.deleteAfterDays = deleteAfterDays;
    if (autoArchiveEnabled !== undefined) policy.autoArchiveEnabled = autoArchiveEnabled;
    if (autoDeleteEnabled !== undefined) policy.autoDeleteEnabled = autoDeleteEnabled;
    policy.updatedBy = (req as any).user?.email ?? null;
    await policy.save();

    return sendSuccess(res, { policy });
  } catch {
    return sendError(res, { code: "RETENTION_UPDATE_FAILED", message: "Unable to update retention policy" }, 500);
  }
};

export const runArchival = async (req: Request, res: Response): Promise<Response | void> => {
  const startTime = Date.now();
  try {
    const policy = await getOrCreatePolicy();
    const cutoffDate = new Date(Date.now() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);

    const archiveResult = await TenderModel.updateMany(
      {
        isArchived: { $ne: true },
        $or: [
          { publishedDate: { $lt: cutoffDate } },
          { parsedAt: { $lt: cutoffDate } }
        ]
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archivedReason: `Auto-archived: older than ${policy.archiveAfterDays} days`
        }
      }
    );

    let deletedCount = 0;
    if (policy.autoDeleteEnabled && policy.deleteAfterDays) {
      const deleteCutoff = new Date(Date.now() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
      const deleteResult = await TenderModel.deleteMany({
        isArchived: true,
        archivedAt: { $lt: deleteCutoff }
      });
      deletedCount = deleteResult.deletedCount ?? 0;
    }

    const durationMs = Date.now() - startTime;
    policy.lastRunAt = new Date();
    policy.lastRunStats = {
      archived: archiveResult.modifiedCount,
      deleted: deletedCount,
      durationMs
    };
    await policy.save();

    return sendSuccess(res, {
      archived: archiveResult.modifiedCount,
      deleted: deletedCount,
      durationMs,
      cutoffDate
    });
  } catch {
    return sendError(res, { code: "ARCHIVAL_FAILED", message: "Archival run failed" }, 500);
  }
};

export const restoreTender = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { tenderId } = req.params;
    const result = await TenderModel.findByIdAndUpdate(
      tenderId,
      { $set: { isArchived: false, archivedAt: null, archivedReason: null } },
      { new: true }
    );
    if (!result) {
      return sendError(res, { code: "NOT_FOUND", message: "Tender not found" }, 404);
    }
    return sendSuccess(res, { tenderId, restored: true });
  } catch {
    return sendError(res, { code: "RESTORE_FAILED", message: "Unable to restore tender" }, 500);
  }
};

export const getArchivedTenders = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Math.min(Number.isFinite(limit) && limit > 0 ? limit : 20, 100);
    const skip = (safePage - 1) * safeLimit;

    const [tenders, total] = await Promise.all([
      TenderModel.find({ isArchived: true })
        .select("title tenderNumber state department publishedDate archivedAt archivedReason totalEstimatedCostINR status")
        .sort({ archivedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      TenderModel.countDocuments({ isArchived: true })
    ]);

    return sendSuccess(res, { tenders, total, page: safePage, pages: Math.ceil(total / safeLimit) });
  } catch {
    return sendError(res, { code: "ARCHIVED_FETCH_FAILED", message: "Unable to fetch archived tenders" }, 500);
  }
};
