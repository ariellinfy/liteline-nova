import { io, Socket } from "socket.io-client";
import {
  Message,
  TypingUser,
  UserPresence,
  MessagePaginationRequest,
  MessageResponse,
  ApiError,
} from "../types";
import { authService } from "./auth";
import { makeLogger } from "../utils/log";

const { log } = makeLogger("SocketService");

type RoomUpdatePayload =
  | { type: "new_message"; message: Message }
  | {
      type:
        | "user_connected"
        | "user_disconnected"
        | "user_joined"
        | "user_left";
      roomId: string;
      presences: UserPresence[];
    };

type Options = {
  serverUrl?: string;
  debug?: boolean;

  // Presence/heartbeat tuning
  idleThresholdMs?: number; // No activity after this ⇒ idle
  periodicMs?: number; // Periodic heartbeat cadence while active
  minImmediateGapMs?: number; // Min gap between any two heartbeats
  ackTimeoutMs?: number; // If ack not received in this time, unlock
};

class SocketService {
  private socket: Socket | null = null;

  // Config
  private serverUrl: string;

  private readonly idleThresholdMs: number;
  private readonly periodicMs: number;
  private readonly minImmediateGapMs: number;
  private readonly ackTimeoutMs: number;

  // Activity/heartbeat state
  private lastActivity = 0;
  private lastHeartbeatSent = 0;
  private awaitingAck = false;

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckTimer: ReturnType<typeof setTimeout> | null = null;

  // Stable bound handlers (so we can attach/detach cleanly)
  private activityListener = () => this.registerActivity();
  private onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.stopHeartbeat();
    } else {
      // Consider this a resume signal; real input will follow soon.
      this.registerActivity();
    }
  };
  private onWindowFocus = () => this.registerActivity();

  constructor(opts: Options = {}) {
    this.serverUrl =
      opts.serverUrl || import.meta.env.VITE_API_URL || "http://localhost:8001";

    this.idleThresholdMs = opts.idleThresholdMs ?? 30000;
    this.periodicMs = opts.periodicMs ?? 25000;
    this.minImmediateGapMs = opts.minImmediateGapMs ?? 8000;
    this.ackTimeoutMs = opts.ackTimeoutMs ?? 6000;
  }

  // ---------- Public API ----------

  connect(): Promise<void> {
    log("connect()");
    return new Promise((resolve, reject) => {
      try {
        const token = authService.getStoredAuth()?.token;

        if (!token) {
          reject(new Error("No authentication token available"));
          return;
        }

        this.socket = io(this.serverUrl, {
          timeout: 20000,
          transports: ["websocket"],
          withCredentials: true,
          path: "/socket.io",
          auth: {
            token,
          },
        });

        // Socket lifecycle
        this.socket.on("connect", this.handleConnect(resolve));
        this.socket.on("connect_error", (err) => {
          log("connect_error", err);
          reject(err);
        });
        this.socket.on("disconnect", this.handleDisconnect);

        // Presence heartbeat ack
        this.socket.on("heartbeat_ack", this.handleHeartbeatAck);
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  disconnect(): void {
    log("disconnect()");
    this.stopHeartbeat();
    this.detachActivityListeners();
    this.resetHeartbeatState();
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    log("isConnected");
    return this.socket?.connected ?? false;
  }

  // ---- Room + messaging actions (also mark as activity) ----
  // Room operations
  joinRoom(roomId: string, alreadyJoined: boolean): void {
    log("joinRoom");
    this.registerActivity();
    this.socket?.emit("join_room", { roomId, alreadyJoined });
  }

  leaveRoom(roomId: string): void {
    log("leaveRoom");
    this.registerActivity();
    this.socket?.emit("leave_room", { roomId });
  }

  // Messaging
  sendMessage(roomId: string, content: string): void {
    log("sendMessage");
    if (!content.trim()) return;
    this.registerActivity();
    this.socket?.emit("send_message", { roomId, content: content.trim() });
  }

  loadMoreMessages(request: MessagePaginationRequest): void {
    log("loadMoreMessages");
    this.socket?.emit("load_more_messages", request);
  }

  // Typing indicators
  startTyping(roomId: string): void {
    log("startTyping");
    this.registerActivity();
    this.socket?.emit("typing_start", { roomId });
  }

  stopTyping(roomId: string): void {
    log("stopTyping");
    this.registerActivity();
    this.socket?.emit("typing_stop", { roomId });
  }

  // Presence
  getRoomPresences(roomId: string): void {
    log("getRoomPresences");
    this.socket?.emit("get_room_presences", { roomId });
  }

  // getMyRooms(): void {
  //   log("getMyRooms");
  //   this.socket?.emit("get_my_rooms");
  // }

  // ---- Event subscriptions (call these once per component mount) ----
  onRoomUpdate(callback: (data: RoomUpdatePayload) => void): void {
    log("onRoomUpdate");
    this.socket?.on("room_update", callback);
  }

  onRoomJoined(
    callback: (data: { roomId: string; presences: UserPresence[] }) => void
  ): void {
    log("onRoomJoined");
    this.socket?.on("room_joined", callback);
  }

  onRoomLeft(callback: (data: { roomId: string }) => void): void {
    log("onRoomLeft");
    this.socket?.on("room_left", callback);
  }

  onUserTyping(callback: (data: TypingUser) => void): void {
    log("onUserTyping");
    this.socket?.on("user_typing", callback);
  }

  onRecentMessages(callback: (data: MessageResponse) => void): void {
    log("onRecentMessages");
    this.socket?.on("recent_messages", callback);
  }

  onMoreMessagesLoaded(
    callback: (data: {
      roomId: string;
      messages: Message[];
      hasMore: boolean;
      nextCursor?: string;
    }) => void
  ): void {
    log("onMoreMessagesLoaded");
    this.socket?.on("more_messages_loaded", callback);
  }

  onRoomPresences(
    callback: (data: { roomId: string; presences: UserPresence[] }) => void
  ): void {
    log("onRoomPresences");
    this.socket?.on("room_presences", callback);
  }

  onMyRooms(callback: (data: { rooms: any[] }) => void): void {
    log("onMyRooms");
    this.socket?.on("my_rooms", callback);
  }

  onError(callback: (error: ApiError) => void): void {
    log("onError");
    this.socket?.on("error", callback);
  }

  removeAllListeners(): void {
    log("removeAllListeners");
    this.socket?.removeAllListeners();
  }

  // ---------- Private: socket lifecycle ----------
  private handleConnect = (resolve: () => void) => () => {
    log("connected");
    // Fresh connection → clear stale heartbeat state
    this.resetHeartbeatState();

    // Treat initial connect as activity
    this.registerActivity();

    // Wire UI-level activity detection
    this.attachActivityListeners();

    // Start relaxed periodic loop
    this.startHeartbeat();
    resolve();
  };

  private handleDisconnect = (reason: string) => {
    log("disconnected", reason);
    this.stopHeartbeat();
    this.detachActivityListeners();
    this.resetHeartbeatState();
  };

  // ---------- Private: activity detection ----------
  private attachActivityListeners() {
    window.addEventListener("mousemove", this.activityListener);
    window.addEventListener("keydown", this.activityListener);
    window.addEventListener("click", this.activityListener);
    window.addEventListener("touchstart", this.activityListener, {
      passive: true,
    });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("focus", this.onWindowFocus);
  }

  private detachActivityListeners() {
    window.removeEventListener("mousemove", this.activityListener);
    window.removeEventListener("keydown", this.activityListener);
    window.removeEventListener("click", this.activityListener);
    window.removeEventListener("touchstart", this.activityListener);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("focus", this.onWindowFocus);
  }

  private registerActivity() {
    const now = Date.now();
    const wasIdle =
      now - this.lastActivity > this.idleThresholdMs || !this.heartbeatInterval;

    this.lastActivity = now;

    // If user was idle, send a single immediate heartbeat to flip presence fast
    if (wasIdle) this.emitHeartbeat("immediate:resume-activity");

    // Ensure the periodic loop is running
    if (
      !this.heartbeatInterval &&
      this.socket?.connected &&
      document.visibilityState === "visible"
    ) {
      this.startHeartbeat();
    }
  }

  // ---------- Private: heartbeat control ----------
  private startHeartbeat(): void {
    log("startHeartbeat");
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const idleMs = now - this.lastActivity;

      if (this.socket?.connected && idleMs <= this.idleThresholdMs) {
        this.emitHeartbeat("periodic");
      } else {
        // User idle → stop loop; server cleanup will mark offline
        this.stopHeartbeat();
      }
    }, this.periodicMs);
  }

  private stopHeartbeat(): void {
    log("stopHeartbeat");
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private emitHeartbeat(reason: string) {
    log("emitHeartbeat", reason);
    if (!this.socket?.connected) return;
    const now = Date.now();

    // throttle + lock
    if (this.awaitingAck) return;
    if (now - this.lastHeartbeatSent < this.minImmediateGapMs) return;

    this.socket.emit("heartbeat");
    this.lastHeartbeatSent = now;
    this.awaitingAck = true;

    // Ack timeout guard (avoid permanent lock if ack is lost)
    if (this.heartbeatAckTimer) clearTimeout(this.heartbeatAckTimer);
    this.heartbeatAckTimer = setTimeout(() => {
      log("heartbeat ack timed out → unlocking");
      this.awaitingAck = false;
      this.heartbeatAckTimer = null;
    }, this.ackTimeoutMs);
  }

  private handleHeartbeatAck = () => {
    log("heartbeat_ack");
    this.awaitingAck = false;
    if (this.heartbeatAckTimer) {
      clearTimeout(this.heartbeatAckTimer);
      this.heartbeatAckTimer = null;
    }
  };

  private resetHeartbeatState() {
    this.awaitingAck = false;
    this.lastHeartbeatSent = 0;
    if (this.heartbeatAckTimer) {
      clearTimeout(this.heartbeatAckTimer);
      this.heartbeatAckTimer = null;
    }
  }
}

export const socketService = new SocketService();
