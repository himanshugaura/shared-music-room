import { createClient } from "redis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";
export const redisClient = createClient({
  url: env.REDIS_URL,
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error:", err);
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    logger.info("Redis connected");
  }
}