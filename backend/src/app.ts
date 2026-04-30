import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { rateLimiter } from "./middleware/rateLimiter.middleware.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { auditsRouter } from "./routes/audits.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { benchmarksRouter } from "./routes/benchmarks.routes.js";
import { pricesRouter } from "./routes/prices.routes.js";
import { tendersRouter } from "./routes/tenders.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { voiceRouter } from "./routes/voice.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { extensionRouter } from "./routes/extension.routes.js";
import { retentionRouter } from "./routes/retention.routes.js";
import { securityRouter } from "./routes/security.routes.js";
import { estimateRouter } from "./routes/estimate.routes.js";
import { translationRouter } from "./routes/translation.routes.js";
import { sendError } from "./utils/apiResponse.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
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
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, data: { status: "ok" } });
});

app.use("/api/auth", authRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/tenders", tendersRouter);
app.use("/api/audits", auditsRouter);
app.use("/api/benchmarks", benchmarksRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/extension", extensionRouter);
app.use("/api/retention", retentionRouter);
app.use("/api/security", securityRouter);
app.use("/api/estimate", estimateRouter);
app.use("/api/translate", translationRouter);

app.use((_req, res) => {
  sendError(res, { code: "NOT_FOUND", message: "Route not found" }, 404);
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const err = error instanceof Error ? error : new Error("Unknown error");
  console.error({
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    error: err.message
  });

  sendError(
    res,
    {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message,
      ...(env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    },
    500
  );
});
