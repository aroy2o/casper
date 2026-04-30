import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { TenderModel } from "../models/Tender.model.js";
import { buildTenderCostBreakdown } from "../utils/costBreakdown.js";
import { determineTenderStatus } from "../utils/tenderStatus.js";

const run = async (): Promise<void> => {
  await connectDB();

  const tenders = await TenderModel.find({}).lean();
  const updates = tenders.map((tender) => ({
    updateOne: {
      filter: { _id: tender._id },
      update: {
        $set: {
          costBreakdown: buildTenderCostBreakdown({
            totalEstimatedCostINR: Number(tender.totalEstimatedCostINR ?? 0),
            projectType: tender.projectType,
            state: tender.state,
            lineItemCount: Array.isArray(tender.lineItems) ? tender.lineItems.length : 0
          }),
          status: determineTenderStatus({
            totalEstimatedCostINR: Number(tender.totalEstimatedCostINR ?? 0),
            lineItemCount: Array.isArray(tender.lineItems) ? tender.lineItems.length : 0,
            riskLevel: tender.status === "flagged" ? "critical" : "low"
          })
        }
      }
    }
  }));

  if (updates.length > 0) {
    await TenderModel.bulkWrite(updates, { ordered: false });
  }

  console.log(`Backfilled cost breakdown for ${updates.length} tenders`);
  await mongoose.disconnect();
};

run().catch(async (error: unknown) => {
  console.error("Backfill failed", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});