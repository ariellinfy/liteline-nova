import { AuthUser, LoginRequest, RegisterRequest } from "../types";

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
  }

  async register(data: RegisterRequest): Promise<AuthUser> {
    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }

    const result = await response.json();
    const authUser: AuthUser = {
      ...result.user,
      token: result.token,
    };

    // Store token in localStorage
    localStorage.setItem("chat_token", result.token);
    localStorage.setItem("chat_user", JSON.stringify(result.user));

    return authUser;
  }

  async login(data: LoginRequest): Promise<AuthUser> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const result = await response.json();
    const authUser: AuthUser = {
      ...result.user,
      token: result.token,
    };

    // Store token in localStorage
    localStorage.setItem("chat_token", result.token);
    localStorage.setItem("chat_user", JSON.stringify(result.user));

    return authUser;
  }

  logout(): void {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");
  }

  getStoredAuth(): AuthUser | null {
    const token = localStorage.getItem("chat_token");
    const userStr = localStorage.getItem("chat_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        return { ...user, token };
      } catch {
        this.logout();
        return null;
      }
    }

    return null;
  }

  getAuthHeader(): string | undefined {
    const token = localStorage.getItem("chat_token");
    return token ? `Bearer ${token}` : undefined;
  }
}

export const authService = new AuthService();
