import jwt from "jsonwebtoken";
import { AuthPayload } from "../utils/types";
import { logger } from "../utils/logger";
const log = logger.child({ mod: "auth-svc" });

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET =
      process.env.JWT_SECRET || "your-secret-key-change-in-production";
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
  }

  generateToken(payload: AuthPayload): string {
    log.debug("generateToken");
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  verifyToken(token: string): AuthPayload | null {
    try {
      log.debug("verifyToken");
      return jwt.verify(token, this.JWT_SECRET) as AuthPayload;
    } catch (error) {
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    log.debug("extractTokenFromHeader");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  }
}
