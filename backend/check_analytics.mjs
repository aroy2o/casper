import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/casper";
await mongoose.connect(MONGO_URI);

const PriceHistory = mongoose.model("PriceHistory", new mongoose.Schema({
  material: String, region: String, stateCode: String, dataPoints: Array
}));

const Tender = mongoose.model("Tender", new mongoose.Schema({
  state: String, stateCode: String, vendorName: String, status: String
}));

const phTotal = await PriceHistory.countDocuments();
const phWithCode = await PriceHistory.countDocuments({ stateCode: { $ne: null } });
const phSample = await PriceHistory.findOne({}).lean();
const phSampleWithCode = await PriceHistory.findOne({ stateCode: { $ne: null } }).lean();
const tTotal = await Tender.countDocuments();
const tWithCode = await Tender.countDocuments({ stateCode: { $ne: null } });

console.log("=== PriceHistory ===");
console.log("Total:", phTotal, "| With stateCode:", phWithCode);
console.log("Sample:", JSON.stringify({ material: phSample?.material, region: phSample?.region, stateCode: phSample?.stateCode, dpCount: phSample?.dataPoints?.length }));
console.log("Sample with code:", JSON.stringify({ material: phSampleWithCode?.material, region: phSampleWithCode?.region, stateCode: phSampleWithCode?.stateCode }));

console.log("\n=== Tenders ===");
console.log("Total:", tTotal, "| With stateCode:", tWithCode);

await mongoose.disconnect();
