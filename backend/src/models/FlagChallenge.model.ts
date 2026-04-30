import { Document, Schema, Types, model } from "mongoose";

export type ChallengeStatus = "pending" | "reviewed" | "upheld" | "dismissed";

export interface IFlagChallenge extends Document {
  tenderId: Types.ObjectId;
  itemDescription: string;
  challengedBy: Types.ObjectId;
  rebuttal: string;
  supportingDocumentURL: string | null;
  status: ChallengeStatus;
  reviewedBy: Types.ObjectId | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFlagChallenge>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: "Tender", required: true },
    itemDescription: { type: String, required: true },
    challengedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rebuttal: { type: String, required: true },
    supportingDocumentURL: { type: String, default: null },
    status: { type: String, enum: ["pending", "reviewed", "upheld", "dismissed"], default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewNote: { type: String, default: null }
  },
  { timestamps: true }
);

schema.index({ tenderId: 1 });
schema.index({ challengedBy: 1, createdAt: -1 });

export const FlagChallengeModel = model<IFlagChallenge>("FlagChallenge", schema);
