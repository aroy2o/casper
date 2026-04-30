import mongoose from "mongoose";
import { TenderModel } from "../models/Tender.model.js";
import { AuditModel } from "../models/Audit.model.js";

async function main() {
  await mongoose.connect("mongodb+srv://abhijeetroy20:%40Please990@cluster0.c2dovsj.mongodb.net/");
  
  // Get one clean tender with all fields
  const t = await TenderModel.findOne({ status: "clean" }).lean();
  console.log("CLEAN TENDER KEYS:", t ? Object.keys(t).join(", ") : "none");
  console.log("CLEAN TENDER VALUES:", JSON.stringify({
    totalEstimatedCostINR: t?.totalEstimatedCostINR,
    status: t?.status,
    tenderNumber: t?.tenderNumber,
    rawText: t?.rawText?.slice(0, 50),
    sourcePortal: t?.sourcePortal,
    publishedDate: t?.publishedDate,
    closingDate: t?.closingDate,
    organisation: (t as any)?.organisation
  }));
  
  // Check if any audit documents exist
  const auditCount = await AuditModel.countDocuments({});
  console.log("Total audits:", auditCount);
  const sampleAudit = await AuditModel.findOne({}).lean();
  console.log("Sample audit keys:", sampleAudit ? Object.keys(sampleAudit).join(", ") : "none");
  console.log("Sample audit values:", JSON.stringify({
    tenderId: sampleAudit?.tenderId,
    auditedAt: sampleAudit?.auditedAt,
    createdAt: (sampleAudit as any)?.createdAt,
    overallInflationPct: sampleAudit?.overallInflationPct,
    totalOverpricedINR: sampleAudit?.totalOverpricedINR,
    riskLevel: sampleAudit?.riskLevel
  }));
  
  await mongoose.disconnect();
}
main().catch(console.error);
