import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { TenderModel } from "../models/Tender.model.js";
import { newTenderQueue } from "../services/queue.service.js";

const main = async (): Promise<void> => {
  await connectDB();

  const errorTenders = await TenderModel.find({ status: "error" })
    .select({ _id: 1, tenderNumber: 1 })
    .lean();

  if (errorTenders.length === 0) {
    console.log("No error tenders found.");
    await mongoose.disconnect();
    return;
  }

  const ids = errorTenders.map((t) => t._id);
  await TenderModel.updateMany({ _id: { $in: ids } }, { $set: { status: "analyzing" } });

  for (const t of errorTenders) {
    await newTenderQueue.add("reaudit", { tenderId: t._id.toString() });
  }

  console.log(`Requeued ${errorTenders.length} tenders`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error("requeue-errors failed:", err);
  process.exit(1);
});
