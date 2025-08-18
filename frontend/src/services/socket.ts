import { io, Socket } from "socket.io-client";

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  type: "text" | "system";
}

export interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface UserPresence {
  userId: string;
  username: string;
  status: "online" | "offline";
  lastSeen: string; // ISO string
  roomId?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          timeout: 20000,
          path: "/socket.io",
        });

        this.socket.on("connect", () => {
          console.log("Connected to server");
          this.startHeartbeat();
          resolve();
        });

        this.socket.on("connect_error", (error) => {
          console.error("Connection error:", error);
          reject(error);
        });

        this.socket.on("disconnect", (reason) => {
          console.log("Disconnected:", reason);
        });

        this.socket.on("heartbeat_ack", () => {
          // Heartbeat acknowledged by server
          console.log("heartbeat ack");
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("heartbeat");
      }
    }, 20000); // Send heartbeat every 20 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  joinRoom(roomId: string, userId: string, username: string): void {
    if (this.socket) {
      this.socket.emit("join_room", { roomId, userId, username });
    }
  }

  leaveRoom(): void {
    if (this.socket) {
      this.socket.emit("leave_room");
    }
  }

  sendMessage(content: string): void {
    if (this.socket) {
      this.socket.emit("send_message", { content });
    }
  }

  startTyping(): void {
    if (this.socket) {
      this.socket.emit("typing_start");
    }
  }

  stopTyping(): void {
    if (this.socket) {
      this.socket.emit("typing_stop");
    }
  }

  updatePresence(status: "online" | "offline"): void {
    if (this.socket) {
      this.socket.emit("update_presence", { status });
    }
  }

  getRoomPresences(): void {
    if (this.socket) {
      this.socket.emit("get_room_presences");
    }
  }

  onRoomUpdate(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on("room_update", callback);
    }
  }

  onRecentMessages(callback: (messages: Message[]) => void): void {
    if (this.socket) {
      this.socket.on("recent_messages", callback);
    }
  }

  onRoomJoined(
    callback: (data: { roomId: string; presences: UserPresence[] }) => void
  ): void {
    if (this.socket) {
      this.socket.on("room_joined", callback);
    }
  }

  onRoomLeft(callback: () => void): void {
    if (this.socket) {
      this.socket.on("room_left", callback);
    }
  }

  onUserTyping(callback: (data: TypingUser) => void): void {
    if (this.socket) {
      this.socket.on("user_typing", callback);
    }
  }

  onPresenceUpdate(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on("presence_update", callback);
    }
  }

  onPresenceUpdated(
    callback: (data: { presences: UserPresence[] }) => void
  ): void {
    if (this.socket) {
      this.socket.on("presence_updated", callback);
    }
  }

  onRoomPresences(
    callback: (data: { presences: UserPresence[] }) => void
  ): void {
    if (this.socket) {
      this.socket.on("room_presences", callback);
    }
  }

  onError(callback: (error: { message: string }) => void): void {
    if (this.socket) {
      this.socket.on("error", callback);
    }
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
