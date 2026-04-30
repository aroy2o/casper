import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { TenderModel } from "../models/Tender.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { AlertModel } from "../models/Alert.model.js";

async function main(): Promise<void> {
  await connectDB();

  const tenders = await TenderModel.find({ sourcePortal: "manual" }).select({ _id: 1 }).lean();
  const tenderIds = tenders.map((t) => t._id);

  const tenderDeleteResult = await TenderModel.deleteMany({ sourcePortal: "manual" });
  const auditDeleteResult = await AuditModel.deleteMany({ tenderId: { $in: tenderIds } });
  const alertDeleteResult = await AlertModel.deleteMany({ tenderId: { $in: tenderIds } });

  console.log(
    `Deleted: ${tenderDeleteResult.deletedCount} tenders, ${auditDeleteResult.deletedCount} audits, ${alertDeleteResult.deletedCount} alerts`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("wipe-seed-data failed", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
