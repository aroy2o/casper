import dotenv from "dotenv";
import { z } from "zod";

const selectedEnvFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: selectedEnvFile });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  ML_SERVICE_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5-coder:7b"),
  OLLAMA_NLU_MODEL: z.string().default("llama3.1"),
  LIBRETRANSLATE_BIN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  IMAGEKIT_PUBLIC_KEY: z.string().optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => {
    const field = issue.path.join(".") || "unknown";
    const expected = issue.code === "invalid_type" ? issue.expected : "valid value";
    return `${field}: expected ${expected}`;
  });
  console.error("Environment validation failed. Missing/invalid fields:");
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
