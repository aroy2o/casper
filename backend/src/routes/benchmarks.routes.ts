import { Router } from "express";
import { getBenchmarks } from "../controllers/benchmarks.controller.js";
import { validateQuery } from "../middleware/validateQuery.middleware.js";
import { benchmarkQuerySchema } from "../schemas/benchmark.schema.js";

export const benchmarksRouter = Router();

benchmarksRouter.get("/", validateQuery(benchmarkQuerySchema), getBenchmarks);
