import { Document, Schema, model } from "mongoose";

export interface IRetentionPolicy extends Document {
  retentionDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null;
  autoArchiveEnabled: boolean;
  autoDeleteEnabled: boolean;
  lastRunAt: Date | null;
  lastRunStats: {
    archived: number;
    deleted: number;
    durationMs: number;
  } | null;
  updatedBy: string | null;
}

const retentionPolicySchema = new Schema<IRetentionPolicy>(
  {
    retentionDays: { type: Number, required: true, default: 1095 },
    archiveAfterDays: { type: Number, required: true, default: 1095 },
    deleteAfterDays: { type: Number, default: null },
    autoArchiveEnabled: { type: Boolean, default: true },
    autoDeleteEnabled: { type: Boolean, default: false },
    lastRunAt: { type: Date, default: null },
    lastRunStats: {
      type: {
        archived: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
        durationMs: { type: Number, default: 0 }
      },
      default: null
    },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

export const RetentionPolicyModel = model<IRetentionPolicy>("RetentionPolicy", retentionPolicySchema);
