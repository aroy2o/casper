import { Document, Schema, Types, model } from "mongoose";

export interface IAlert extends Document {
  userId: Types.ObjectId;
  type: "new_tender_flagged" | "price_spike" | "audit_complete" | "scrape_error";
  message: string;
  tenderId: Types.ObjectId | null;
  material: string | null;
  isRead: boolean;
  createdAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["new_tender_flagged", "price_spike", "audit_complete", "scrape_error"],
      required: true
    },
    message: { type: String, required: true },
    tenderId: { type: Schema.Types.ObjectId, ref: "Tender", default: null },
    material: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const AlertModel = model<IAlert>("Alert", alertSchema);
