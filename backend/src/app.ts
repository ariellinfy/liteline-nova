import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { logger } from "./utils/logger";

dotenv.config();

export function buildApp() {
  const app = express();

  // Parse ALLOWED_ORIGINS from env (comma-separated)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : [];

  // Enable CORS for the frontend origin
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., curl, Postman) or if origin is in allowedOrigins
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );

  app.use(
    pinoHttp({
      logger,
      // use client-provided request-id if present; otherwise generate
      genReqId: (req, res) =>
        (req.headers["x-request-id"] as string) || crypto.randomUUID(),
      // choose level based on status / error
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      // keep logs lean: method + url, statusCode
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    })
  );
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    req.log.info("Health check");
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  return app;
}
