import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";
import { DatabaseService } from "../services/database";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

function sendError(
  res: Response,
  status: number,
  message: string,
  code: "UNAUTHORIZED" | "GENERIC" = "GENERIC"
) {
  return res.status(status).json({ error: { message, code } });
}

export function createAuthMiddleware(
  authService: AuthService,
  dbService: DatabaseService
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      req.log?.debug("createAuthMiddleware");

      const token = authService.extractTokenFromHeader(
        req.headers.authorization
      );

      if (!token) {
        return sendError(res, 401, "No token provided", "UNAUTHORIZED");
      }

      const payload = authService.verifyToken(token);
      if (!payload) {
        return sendError(res, 401, "Invalid token", "UNAUTHORIZED");
      }

      // Verify user still exists
      const user = await dbService.getUserById(payload.userId);
      if (!user) {
        return sendError(res, 401, "User not found", "UNAUTHORIZED");
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      next();
    } catch (error) {
      req.log?.error(error as Error, "Auth middleware error");
      return sendError(res, 500, "Authentication error", "GENERIC");
    }
  };
}

// Socket.IO authentication middleware
export function createSocketAuthMiddleware(
  authService: AuthService,
  dbService: DatabaseService
) {
  return async (socket: any, next: any) => {
    try {
      console.log("createSocketAuthMiddleware");

      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("No token provided"));
      }

      const payload = authService.verifyToken(token);
      if (!payload) {
        return next(new Error("Invalid token"));
      }

      const user = await dbService.getUserById(payload.userId);
      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication failed"));
    }
  };
}
