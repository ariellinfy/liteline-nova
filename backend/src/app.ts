import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

export function buildApp() {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
    })
  );
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  return app;
}
