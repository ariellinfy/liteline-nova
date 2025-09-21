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

  // Verify token
  router.get("/validate", async (req, res) => {
    req.log.info("auth/validate");
    try {
      const token = chatService.authService.extractTokenFromHeader(
        req.headers.authorization
      );

      if (!token) {
        return sendError(res, 401, "No token provided", "UNAUTHORIZED");
      }

      const payload = chatService.authService.verifyToken(token);
      if (!payload) {
        return sendError(res, 401, "Invalid or expired token", "UNAUTHORIZED");
      }

      const user = await chatService.dbService.getUserById(payload.userId);
      if (!user) {
        return sendError(res, 401, "User not found", "UNAUTHORIZED");
      }

      res.json({ valid: true });
    } catch (error) {
      res.log.error(error, "Token validation error");
      return sendError(res, 500, "Token validation failed", "GENERIC");
    }
  });

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
