import http from "node:http";
import axios from "axios";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { isRedisReady, redis } from "./config/redis.js";
import { ollamaClient } from "./services/ollamaClient.service.js";
import { scheduleScrapers, startQueueWorkers } from "./services/queue.service.js";
import {
  isLibreTranslateReady,
  libreTranslateEvents,
  startLibreTranslate,
  stopLibreTranslate
} from "./services/libreTranslateService.js";

let httpServer: http.Server | null = null;
let ioServer: Server | null = null;
const userSocketMap = new Map<string, Set<string>>();
let shuttingDown = false;

interface AuthPayload {
  userId: string;
  role: "admin" | "analyst" | "viewer";
}

export const emitAlertToUser = (userId: string, alert: unknown): void => {
  const socketIds = userSocketMap.get(userId);
  if (!ioServer || !socketIds || socketIds.size === 0) {
    return;
  }
  for (const socketId of socketIds) {
    ioServer.to(socketId).emit("alert", alert);
  }
};

const probeMlService = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${env.ML_SERVICE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
};

const gracefulShutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down CASPER backend...");
  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    await mongoose.disconnect();
    await redis.quit();
    await stopLibreTranslate();
  } finally {
    process.exit(0);
  }
};

const start = async (): Promise<void> => {
  console.log("LibreTranslate starting...");
  void startLibreTranslate().then(() => {
    if (!isLibreTranslateReady()) {
      console.log("LibreTranslate unavailable, Google fallback active");
    }
  });
  libreTranslateEvents.once("ready", () => {
    console.log("LibreTranslate ready");
  });

  await connectDB();
  await redis.ping().catch(() => undefined);

  startQueueWorkers();
  await scheduleScrapers();

  const mlReachable = await probeMlService();
  const ollamaReachable = await ollamaClient.isAvailable();

  app.locals.mlServiceReachable = mlReachable;
  app.locals.ollamaReachable = ollamaReachable;

  if (!mlReachable) {
    console.warn("WARNING: ML service is unreachable. ML-dependent endpoints will return 503.");
  }

  if (!ollamaReachable) {
    console.warn("WARNING: Ollama is unreachable. Voice/NLP enhancement may degrade.");
  }

  httpServer = http.createServer(app);
  ioServer = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin
        if (!origin) return callback(null, true);
        
        // Allow the configured frontend origin
        if (origin === env.CORS_ORIGIN) return callback(null, true);
        
        // Allow chrome extensions
        if (origin.startsWith("chrome-extension://")) return callback(null, true);
        
        // Allow localhost origins (for development)
        if (origin.includes("localhost")) return callback(null, true);
        
        // Deny other origins
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    }
  });

  ioServer.use((socket, next) => {
    const rawToken = socket.handshake.auth.token as string | undefined;
    if (!rawToken || !rawToken.startsWith("Bearer ")) {
      next(new Error("Unauthorized"));
      return;
    }
    const token = rawToken.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  ioServer.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      const existing = userSocketMap.get(userId) ?? new Set<string>();
      existing.add(socket.id);
      userSocketMap.set(userId, existing);
    }

    socket.emit("connected", { message: "CASPER realtime connected" });

    socket.on("disconnect", () => {
      if (!userId) return;
      const existing = userSocketMap.get(userId);
      if (!existing) return;
      existing.delete(socket.id);
      if (existing.size === 0) {
        userSocketMap.delete(userId);
      }
    });
  });

  httpServer.listen(env.PORT, () => {
    console.log(`✓ MongoDB connected`);
    console.log(`✓ Redis connected${isRedisReady() ? "" : " (degraded)"}`);
    console.log(`${mlReachable ? "✓" : "⚠"} ML service reachable`);
    console.log(`${ollamaReachable ? "✓" : "⚠"} Ollama reachable`);
    console.log(`✓ BullMQ workers started`);
    console.log(`✓ HTTP server listening on port ${env.PORT}`);
  });
};

process.on("SIGINT", () => {
  void gracefulShutdown();
});

process.on("SIGTERM", () => {
  void gracefulShutdown();
});

// nodemon/dev restarts often use SIGUSR2; ensure LibreTranslate is terminated first.
process.on("SIGUSR2", () => {
  void gracefulShutdown();
});

process.on("uncaughtException", () => {
  void gracefulShutdown();
});

process.on("unhandledRejection", () => {
  void gracefulShutdown();
});

start().catch((error: unknown) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
