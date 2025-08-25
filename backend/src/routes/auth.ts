import { Router } from "express";
import { ChatService } from "../services/chat";
import { LoginRequest, RegisterRequest } from "../types";

export function createAuthRoutes(chatService: ChatService) {
  const router = Router();

  // Register
  router.post("/register", async (req, res) => {
    try {
      const { username, email, password }: RegisterRequest = req.body;
      console.log("routes/auth/register");

      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ error: "Username, email, and password are required" });
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }

      const result = await chatService.registerUser(username, email, password);

      res.status(201).json({
        user: result.user,
        token: result.token,
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      if (error.code === "23505") {
        // Unique constraint violation
        if (error.constraint?.includes("username")) {
          return res.status(409).json({ error: "Username already exists" });
        }
        if (error.constraint?.includes("email")) {
          return res.status(409).json({ error: "Email already exists" });
        }
      }

      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  router.post("/login", async (req, res) => {
    try {
      const { email, password }: LoginRequest = req.body;
      console.log("routes/auth/login");
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const result = await chatService.loginUser(email, password);

      if (!result) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  return router;
}
