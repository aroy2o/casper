import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { TenderModel } from "../models/Tender.model.js";

function inferState(title: string, dept: string): string {
  const text = `${title} ${dept}`.toLowerCase();
  if (/assam|guwahati|dibrugarh|jorhat|silchar/.test(text)) return "assam";
  if (/meghalaya|shillong|tura/.test(text)) return "meghalaya";
  if (/arunachal|itanagar|naharlagun/.test(text)) return "arunachal";
  if (/manipur|imphal/.test(text)) return "manipur";
  if (/nagaland|kohima|dimapur/.test(text)) return "nagaland";
  if (/mizoram|aizawl/.test(text)) return "mizoram";
  if (/tripura|agartala/.test(text)) return "tripura";
  if (/sikkim|gangtok/.test(text)) return "sikkim";
  return "national";
}

async function run(): Promise<void> {
  await connectDB();

  const deletedTitleDate = await TenderModel.deleteMany({
    title: { $regex: /^(\d{4}-\d{2}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})/ }
  });

  const deletedTitleEqualsTender = await TenderModel.deleteMany({
    $expr: { $eq: ["$title", "$tenderNumber"] }
  });

  const deletedDepartmentDate = await TenderModel.deleteMany({
    department: { $regex: /\d{2}[-/]\d{2}[-/]\d{4}/ }
  });

  const deletedSuspiciousCost = await TenderModel.deleteMany({
    $or: [{ totalEstimatedCostINR: 0 }, { totalEstimatedCostINR: { $mod: [10_000, 3_000] } }]
  });

  const otherTenders = await TenderModel.find({ state: "other" }).select({ _id: 1, title: 1, department: 1 }).lean();
  let stateFixed = 0;
  for (const tender of otherTenders) {
    const inferredState = inferState(tender.title, tender.department);
    if (inferredState !== "national") {
      await TenderModel.updateOne({ _id: tender._id }, { $set: { state: inferredState } });
      stateFixed += 1;
    }
  }

  console.log("Cleanup complete");
  console.log("Deleted title-as-date:", deletedTitleDate.deletedCount ?? 0);
  console.log("Deleted title==tenderNumber:", deletedTitleEqualsTender.deletedCount ?? 0);
  console.log("Deleted department-as-date:", deletedDepartmentDate.deletedCount ?? 0);
  console.log("Deleted suspicious cost rows:", deletedSuspiciousCost.deletedCount ?? 0);
  console.log("Updated inferred state rows:", stateFixed);
}

run()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("clean-tenders failed", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
