import {
  Room,
  CreateRoomRequest,
  JoinRoomRequest,
  MessagePaginationRequest,
  MessageResponse,
  ApiErrorCode,
  ApiError,
} from "../types";
import { authService } from "./auth";

class RoomService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8001";
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const authHeader = authService.getAuthHeader();
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      throw new ApiError("Network error", "GENERIC");
    }
    if (!response.ok) {
      let body: any = null;

      // Try to parse JSON, but don't swallow later throws
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      const message: string =
        body?.error?.message ?? body?.message ?? "Request failed";

      const code: ApiErrorCode = body?.error?.code ?? body?.code ?? "GENERIC";

      throw new ApiError(message, code);
    }
    return response.json();
  }

  async getPublicRooms(): Promise<Room[]> {
    const result = await this.makeRequest(`${this.baseUrl}/api/rooms/public`);
    return result.rooms;
  }

  async getUserRooms(): Promise<Room[]> {
    const result = await this.makeRequest(`${this.baseUrl}/api/rooms/my-rooms`);
    return result.rooms;
  }

  async createRoom(data: CreateRoomRequest): Promise<Room> {
    const result = await this.makeRequest(`${this.baseUrl}/api/rooms/create`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result.room;
  }

  async joinRoom(
    data: JoinRoomRequest
  ): Promise<{ room: Room; alreadyJoined: boolean }> {
    const result = await this.makeRequest(`${this.baseUrl}/api/rooms/join`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return result;
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.makeRequest(`${this.baseUrl}/api/rooms/${roomId}/leave`, {
      method: "POST",
    });
  }

  // async getMessages(
  //   request: MessagePaginationRequest
  // ): Promise<MessageResponse> {
  //   const params = new URLSearchParams({
  //     limit: request.limit?.toString() || "50",
  //   });

  //   if (request.before) {
  //     params.append("before", request.before);
  //   }

  //   return await this.makeRequest(
  //     `${this.baseUrl}/api/rooms/${request.roomId}/messages?${params}`
  //   );
  // }

  // async preloadRoomCache(roomId: string): Promise<void> {
  //   await this.makeRequest(
  //     `${this.baseUrl}/api/rooms/${roomId}/preload-cache`,
  //     {
  //       method: "POST",
  //     }
  //   );
  // }
}

export const roomService = new RoomService();
