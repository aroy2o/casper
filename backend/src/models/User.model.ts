import { Document, Schema, model } from "mongoose";
import { UserRole } from "../types/index.js";

export interface IUserPreferences {
  alertThresholdPct: number;
  watchedRegions: string[];
  notifyEmail: boolean;
  notifyPush: boolean;
  pushSubscription: Record<string, unknown> | null;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organization: string;
  createdAt: Date;
  preferences: IUserPreferences;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "analyst", "viewer"], default: "viewer" },
    organization: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    preferences: {
      alertThresholdPct: { type: Number, default: 20 },
      watchedRegions: { type: [String], default: ["assam"] },
      notifyEmail: { type: Boolean, default: false },
      notifyPush: { type: Boolean, default: true },
      pushSubscription: { type: Schema.Types.Mixed, default: null }
    }
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", userSchema);
