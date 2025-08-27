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
    this.baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
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
      try {
        const body = await response.json();
        const message: string = body?.error?.message ?? "Request failed";
        const code: ApiErrorCode | undefined = body?.error?.code;
        throw new ApiError(message, code);
      } catch {
        throw new ApiError("Request failed", "GENERIC");
      }
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
