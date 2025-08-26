import { Router } from "express";
import { ChatService } from "../services/chat";
import { LoginRequest, RegisterRequest } from "../utils/types";

export function createAuthRoutes(chatService: ChatService) {
  const router = Router();

  const sendError = (
    res: any,
    status: number,
    message: string,
    code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "GENERIC"
  ) => res.status(status).json({ error: { message, code } });

  // Register
  router.post("/register", async (req, res) => {
    req.log.info("auth/register");
    try {
      const { username, email, password }: RegisterRequest = req.body;

      if (!username || !email || !password) {
        return sendError(
          res,
          400,
          "Username, email, and password are required",
          "VALIDATION_ERROR"
        );
      }

      if (password.length < 6) {
        return sendError(
          res,
          400,
          "Password must be at least 6 characters",
          "VALIDATION_ERROR"
        );
      }

      const result = await chatService.registerUser(username, email, password);

      res.status(201).json({
        user: result.user,
        token: result.token,
      });
    } catch (error: any) {
      res.log.error(error, "Registration error");

      if (error.code === "23505") {
        // Unique constraint violation
        if (error.constraint?.includes("username")) {
          return sendError(
            res,
            409,
            "Username already exists",
            "VALIDATION_ERROR"
          );
        }
        if (error.constraint?.includes("email")) {
          return sendError(
            res,
            409,
            "Email already exists",
            "VALIDATION_ERROR"
          );
        }
      }
      return sendError(res, 500, "Registration failed", "GENERIC");
    }
  });

  // Login
  router.post("/login", async (req, res) => {
    req.log.info("auth/login");
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        return sendError(
          res,
          400,
          "Email and password are required",
          "VALIDATION_ERROR"
        );
      }

      const result = await chatService.loginUser(email, password);

      if (!result) {
        return sendError(res, 401, "Invalid credentials", "UNAUTHORIZED");
      }

      res.json({
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      res.log.error(error, "Login error");
      return sendError(res, 500, "Login failed", "GENERIC");
    }
  });

  return router;
}
