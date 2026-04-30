import mongoose from "mongoose";
import { env } from "./env.js";

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

mongoose.connection.on("connected", () => {
  const host = mongoose.connection.host || "unknown-host";
  console.log(`MongoDB connected to ${host}`);
});

mongoose.connection.on("error", (error: unknown) => {
  console.error("MongoDB error", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

export const connectDB = async (): Promise<void> => {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${RETRY_ATTEMPTS}`);
      await mongoose.connect(env.MONGO_URI, {
        maxPoolSize: 20,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000
      });
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed`, error);
      if (attempt === RETRY_ATTEMPTS) {
        throw error;
      }
      await wait(RETRY_DELAY_MS);
    }
  }
};
