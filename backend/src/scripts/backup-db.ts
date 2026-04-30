import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AlertModel } from "../models/Alert.model.js";
import { AuditModel } from "../models/Audit.model.js";
import { BenchmarkModel } from "../models/Benchmark.model.js";
import { PriceHistoryModel } from "../models/PriceHistory.model.js";
import { PriceModel } from "../models/Price.model.js";
import { TenderModel } from "../models/Tender.model.js";
import { UserModel } from "../models/User.model.js";

const safeStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(process.cwd(), "backups");
const backupFile = path.join(backupDir, `casper-backup-${safeStamp}.json`);

const run = async (): Promise<void> => {
  await connectDB();

  const [users, tenders, audits, prices, priceHistory, alerts, benchmarks] = await Promise.all([
    UserModel.find({}).lean(),
    TenderModel.find({}).lean(),
    AuditModel.find({}).lean(),
    PriceModel.find({}).lean(),
    PriceHistoryModel.find({}).lean(),
    AlertModel.find({}).lean(),
    BenchmarkModel.find({}).lean()
  ]);

  const payload = {
    backupCreatedAt: new Date().toISOString(),
    mongoDatabase: mongoose.connection.db?.databaseName ?? "unknown",
    counts: {
      users: users.length,
      tenders: tenders.length,
      audits: audits.length,
      prices: prices.length,
      priceHistory: priceHistory.length,
      alerts: alerts.length,
      benchmarks: benchmarks.length
    },
    data: {
      users,
      tenders,
      audits,
      prices,
      priceHistory,
      alerts,
      benchmarks
    }
  };

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`Backup written: ${backupFile}`);
  console.log(payload.counts);

  await mongoose.disconnect();
};

run().catch(async (error: unknown) => {
  console.error("Backup failed", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
