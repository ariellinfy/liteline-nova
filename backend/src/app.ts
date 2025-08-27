import express from "express";
import dotenv from "dotenv";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { logger } from "./utils/logger";

dotenv.config();

export function buildApp() {
  const app = express();

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
