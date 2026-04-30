import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

let redisReady = false;

redis.on("connect", () => {
  redisReady = true;
  console.log("Redis connected");
});

redis.on("error", (error: unknown) => {
  redisReady = false;
  console.error("Redis error", error);
});

redis.on("close", () => {
  redisReady = false;
  console.warn("Redis connection closed");
});

redis.on("reconnecting", () => {
  redisReady = false;
  console.warn("Redis reconnecting");
});

export const isRedisReady = (): boolean => {
  return redisReady || redis.status === "ready";
};

export const cacheTtlSeconds = {
  prices: 60 * 60,
  benchmark: 6 * 60 * 60,
  audit: 24 * 60 * 60
} as const;
