import mongoose from "mongoose";
import { TenderModel } from "../models/Tender.model.js";
import { AuditModel } from "../models/Audit.model.js";

async function main() {
  await mongoose.connect("mongodb+srv://abhijeetroy20:%40Please990@cluster0.c2dovsj.mongodb.net/");
  const total = await TenderModel.countDocuments({});
  const clean = await TenderModel.countDocuments({ status: "clean" });
  const flagged = await TenderModel.countDocuments({ status: "flagged" });
  const analyzing = await TenderModel.countDocuments({ status: "analyzing" });
  const pending = await TenderModel.countDocuments({ status: "pending" });
  const errorCount = await TenderModel.countDocuments({ status: "error" });
  console.log(JSON.stringify({ total, clean, flagged, analyzing, pending, error: errorCount }));

  const manual = await TenderModel.findOne({ sourcePortal: "manual" }).lean();
  const scraped = await TenderModel.findOne({ sourcePortal: { $ne: "manual" } }).lean();
  console.log("MANUAL:", JSON.stringify(manual)?.slice(0, 800));
  console.log("SCRAPED:", JSON.stringify(scraped)?.slice(0, 800));
  await mongoose.disconnect();
}
main().catch(console.error);
