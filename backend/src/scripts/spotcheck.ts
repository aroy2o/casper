import mongoose from "mongoose";
import { TenderModel } from "../models/Tender.model.js";

async function main() {
  await mongoose.connect("mongodb+srv://abhijeetroy20:%40Please990@cluster0.c2dovsj.mongodb.net/");
  
  const withCost = await TenderModel.countDocuments({ totalEstimatedCostINR: { $gt: 0 } });
  console.log("tenders with cost > 0:", withCost);
  
  const sample3 = await TenderModel.find({ totalEstimatedCostINR: { $gt: 0 } })
    .limit(3).select({ title: 1, totalEstimatedCostINR: 1, status: 1 }).lean();
  console.log("sample with cost:", JSON.stringify(sample3, null, 2));
  
  const cleanSample = await TenderModel.find({ status: "clean" })
    .limit(3)
    .select({ title: 1, totalEstimatedCostINR: 1, sourcePortal: 1, department: 1, state: 1, projectType: 1, closingDate: 1, publishedDate: 1, rawText: 1 })
    .lean();
  console.log("clean sample:", JSON.stringify(cleanSample, null, 2));
  
  await mongoose.disconnect();
}
main().catch(console.error);
