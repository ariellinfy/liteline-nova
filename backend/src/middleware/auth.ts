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
      console.log("createAuthMiddleware:req.headers");
      const token = authService.extractTokenFromHeader(
        req.headers.authorization
      );

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const payload = authService.verifyToken(token);
      if (!payload) {
        return res.status(401).json({ error: "Invalid token" });
      }

      // Verify user still exists
      const user = await dbService.getUserById(payload.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ error: "Authentication error" });
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
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");
      console.log("createSocketAuthMiddleware");
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
