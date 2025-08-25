import { io, Socket } from "socket.io-client";
import {
  Message,
  TypingUser,
  UserPresence,
  MessagePaginationRequest,
  MessageResponse,
} from "../types";
import { authService } from "./auth";

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
  private debug: boolean;

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
      opts.serverUrl ||
      import.meta.env.VITE_SERVER_URL ||
      "http://localhost:3001";
    this.debug = !!opts.debug;

    this.idleThresholdMs = opts.idleThresholdMs ?? 30000;
    this.periodicMs = opts.periodicMs ?? 25000;
    this.minImmediateGapMs = opts.minImmediateGapMs ?? 8000;
    this.ackTimeoutMs = opts.ackTimeoutMs ?? 6000;
  }

  // ---------- Public API ----------

  connect(): Promise<void> {
    this.log("connect()");
    return new Promise((resolve, reject) => {
      try {
        const token = authService.getStoredAuth()?.token;
        if (!token) {
          reject(new Error("No authentication token available"));
          return;
        }

        this.socket = io(this.serverUrl, {
          timeout: 20000,
          path: "/socket.io",
          auth: {
            token,
          },
        });

        // Socket lifecycle
        this.socket.on("connect", this.handleConnect(resolve));
        this.socket.on("connect_error", (err) => {
          this.log("connect_error", err);
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
    this.log("disconnect()");
    this.stopHeartbeat();
    this.detachActivityListeners();
    this.resetHeartbeatState();
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    this.log("isConnected");
    return this.socket?.connected ?? false;
  }

  // ---- Room + messaging actions (also mark as activity) ----
  // Room operations
  joinRoom(roomId: string, alreadyJoined: boolean): void {
    this.log("joinRoom J9 C8");
    this.registerActivity();
    this.socket?.emit("join_room", { roomId, alreadyJoined });
  }

  leaveRoom(roomId: string): void {
    this.log("eaveRoom L5 ");
    this.registerActivity();
    this.socket?.emit("leave_room", { roomId });
  }

  // Messaging
  sendMessage(roomId: string, content: string): void {
    this.log("sendMessage M2");
    if (!content.trim()) return;
    this.registerActivity();
    this.socket?.emit("send_message", { roomId, content: content.trim() });
  }

  loadMoreMessages(request: MessagePaginationRequest): void {
    this.log("loadMoreMessages");
    this.socket?.emit("load_more_messages", request);
  }

  // Typing indicators
  startTyping(roomId: string): void {
    this.log("startTyping");
    this.registerActivity();
    this.socket?.emit("typing_start", { roomId });
  }

  stopTyping(roomId: string): void {
    this.log("stopTyping");
    this.registerActivity();
    this.socket?.emit("typing_stop", { roomId });
  }

  // Presence
  getRoomPresences(roomId: string): void {
    this.log("getRoomPresences");
    this.socket?.emit("get_room_presences", { roomId });
  }

  // getMyRooms(): void {
  //   this.log("getMyRooms");
  //   this.socket?.emit("get_my_rooms");
  // }

  // ---- Event subscriptions (call these once per component mount) ----
  onRoomUpdate(callback: (data: RoomUpdatePayload) => void): void {
    this.log("onRoomUpdate");
    this.socket?.on("room_update", callback);
  }

  onRoomJoined(
    callback: (data: { roomId: string; presences: UserPresence[] }) => void
  ): void {
    this.log("onRoomJoined");
    this.socket?.on("room_joined", callback);
  }

  onRoomLeft(callback: (data: { roomId: string }) => void): void {
    this.log("onRoomLeft");
    this.socket?.on("room_left", callback);
  }

  onUserTyping(callback: (data: TypingUser) => void): void {
    this.log("onUserTyping");
    this.socket?.on("user_typing", callback);
  }

  onRecentMessages(callback: (data: MessageResponse) => void): void {
    this.log("onRecentMessages");
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
    this.log("onMoreMessagesLoaded");
    this.socket?.on("more_messages_loaded", callback);
  }

  onRoomPresences(
    callback: (data: { roomId: string; presences: UserPresence[] }) => void
  ): void {
    this.log("onRoomPresences");
    this.socket?.on("room_presences", callback);
  }

  onMyRooms(callback: (data: { rooms: any[] }) => void): void {
    this.log("onMyRooms");
    this.socket?.on("my_rooms", callback);
  }

  onError(callback: (error: { message: string }) => void): void {
    this.log("onError");
    this.socket?.on("error", callback);
  }

  removeAllListeners(): void {
    this.log("removeAllListeners");
    this.socket?.removeAllListeners();
  }

  // ---------- Private: socket lifecycle ----------
  private handleConnect = (resolve: () => void) => () => {
    this.log("connected");
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
    this.log("disconnected", reason);
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
    this.log("startHeartbeat");
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
    this.log("stopHeartbeat");
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private emitHeartbeat(reason: string) {
    this.log("emitHeartbeat", reason);
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
      this.log("heartbeat ack timed out → unlocking");
      this.awaitingAck = false;
      this.heartbeatAckTimer = null;
    }, this.ackTimeoutMs);
  }

  private handleHeartbeatAck = () => {
    this.log("heartbeat_ack");
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

  // ---------- Private: utils ----------
  private log(...args: any[]) {
    if (this.debug) console.log("[SocketService]", ...args);
  }
}

export const socketService = new SocketService({ debug: false });
