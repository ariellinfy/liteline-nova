import type { Server } from "socket.io";
import { DatabaseService } from "./database";
import { RedisService } from "./redis";
import { AuthService } from "./auth";
import {
  User,
  Message,
  Room,
  UserPresence,
  CreateRoomRequest,
  JoinRoomRequest,
  MessagePaginationRequest,
  MessageResponse,
  ApiError,
} from "../utils/types";
import { logger } from "../utils/logger";
const log = logger.child({ mod: "chat" });

export class ChatService {
  dbService: DatabaseService;
  private redisService: RedisService;
  authService: AuthService;
  private io: Server;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    dbService: DatabaseService,
    redisService: RedisService,
    authService: AuthService,
    io: Server
  ) {
    this.dbService = dbService;
    this.redisService = redisService;
    this.authService = authService;
    this.io = io;

    // Start heartbeat cleanup process
    this.heartbeatInterval = setInterval(async () => {
      log.debug("cleanupStaleUsers tick");
      await this.cleanupStaleUsers();
    }, 30000); // Check every 30 seconds
  }

  // Auth methods
  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    log.debug("registerUser");
    const user = await this.dbService.createUser(username, email, password);

    const token = this.authService.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    return { user, token };
  }

  async loginUser(
    email: string,
    password: string
  ): Promise<{ user: User; token: string } | null> {
    log.debug("loginUser");
    const user = await this.dbService.authenticateUser(email, password);

    if (!user) {
      return null;
    }

    const token = this.authService.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    return { user, token };
  }

  // Room methods
  async getPublicRooms(userId?: string): Promise<Room[]> {
    log.debug("getPublicRooms");
    return await this.dbService.getPublicRooms(userId);
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    log.debug("getUserRooms");
    return await this.dbService.getUserRooms(userId);
  }

  async getUserRoomIds(userId: string): Promise<string[]> {
    log.debug("getUserRoomIds");
    return await this.dbService.getUserRoomIds(userId);
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    log.debug("isUserInRoom");
    return await this.dbService.isUserInRoom(userId, roomId);
  }

  async createRoom(
    request: CreateRoomRequest,
    createdBy: string
  ): Promise<Room> {
    log.debug("createRoom");
    const room = await this.dbService.createRoom(
      request.name,
      request.description,
      request.isPrivate,
      request.passcode,
      createdBy
    );

    // Auto-join creator to the room
    await this.dbService.addUserToRoom(createdBy, room.id);

    // Add user to room in Redis
    await this.redisService.addUserToRoom(createdBy, room.id);
    return { ...room, memberCount: 1 };
  }

  async joinRoom(
    userId: string,
    request: JoinRoomRequest
  ): Promise<{
    success: boolean;
    alreadyJoined?: boolean;
    room?: Room;
    error?: ApiError;
  }> {
    log.debug("joinRoom");
    const room = await this.dbService.getRoomByName(request.roomId);
    if (!room) {
      return {
        success: false,
        error: { message: "Room not found", code: "NOT_FOUND" },
      };
    }

    const alreadyJoined = await this.dbService.isUserInRoom(userId, room.id);

    if (alreadyJoined) {
      return { success: true, alreadyJoined, room };
    }

    // Check if room is private and validate passcode
    if (room.isPrivate) {
      if (!request.passcode) {
        return {
          success: false,
          alreadyJoined,
          error: {
            message: "Passcode required for private room",
            code: "PASSCODE_REQUIRED",
          },
        };
      }

      const isValidPasscode = await this.dbService.validateRoomPasscode(
        room.id,
        request.passcode
      );
      if (!isValidPasscode) {
        return {
          success: false,
          alreadyJoined,
          error: { message: "Invalid passcode", code: "INVALID_PASSCODE" },
        };
      }
    }

    // Add user to room in database
    await this.dbService.addUserToRoom(userId, room.id);

    // Add user to room in Redis
    await this.redisService.addUserToRoom(userId, room.id);

    return { success: true, alreadyJoined, room };
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    log.debug("leaveRoom");
    const room = await this.dbService.getRoomById(roomId);

    // Remove from database & Redis
    if (room) {
      await this.dbService.removeUserFromRoom(userId, room.id);
      await this.redisService.removeUserFromRoom(userId, roomId);
    }
  }

  // Hybrid message storage methods
  async createMessage(
    roomId: string,
    userId: string,
    content: string,
    messageType: "text" | "system" = "text"
  ): Promise<Message> {
    log.debug("createMessage");
    // Store in PostgreSQL first (persistent storage)
    const message = await this.dbService.storeMessage(
      roomId,
      userId,
      content,
      messageType
    );

    // Store in Redis cache for fast access
    await this.redisService.storeMessageInCache(roomId, message);

    // Emit to room
    this.io.to(roomId).emit("room_update", { type: "new_message", message });

    return message;
  }

  // Hybrid message retrieval - Redis first, fallback to PostgreSQL
  async getRecentMessages(
    roomId: string,
    limit: number = 50
  ): Promise<Message[]> {
    log.debug("getRecentMessages");
    try {
      // Try to get from Redis cache first
      const cachedMessages = await this.redisService.getRecentMessagesFromCache(
        roomId,
        limit
      );

      if (cachedMessages.length > 0) {
        // If we have enough messages in cache, return them
        if (cachedMessages.length >= limit) {
          return cachedMessages.slice(0, limit);
        }

        // If we have some but not enough, get the rest from DB
        const remainingLimit = limit - cachedMessages.length;
        const oldestCachedMessage = cachedMessages[0];

        const dbResult = await this.dbService.getMessagesFromDB(
          roomId,
          remainingLimit,
          oldestCachedMessage.id
        );

        // Combine messages: DB messages (older) + cached messages (newer)
        return [...dbResult.messages, ...cachedMessages];
      }

      // No cached messages, get from database and populate cache
      const dbMessages = await this.dbService.getRecentMessagesFromDB(
        roomId,
        limit
      );

      // dbMessages is chronological (oldest -> newest)
      for (let i = 0; i < dbMessages.length; i++) {
        await this.redisService.storeMessageInCache(roomId, dbMessages[i]); // LPUSH
      }

      return dbMessages;
    } catch (error) {
      log.error(error, "Error getting recent messages");

      // Fallback to database only
      return await this.dbService.getRecentMessagesFromDB(roomId, limit);
    }
  }

  // Paginated message retrieval for loading older messages (need to check logic)
  async getMessages(
    request: MessagePaginationRequest
  ): Promise<MessageResponse> {
    log.debug("getMessages");
    const { roomId, limit = 50, before } = request;

    if (!before) {
      // First page - get recent messages (hybrid approach)
      const messages = await this.getRecentMessages(roomId, limit);

      // Check if there are more messages in DB
      const totalInCache = await this.redisService.getRecentMessageCount(
        roomId
      );
      const dbResult = await this.dbService.getMessagesFromDB(
        roomId,
        1,
        messages.length > 0 ? messages[0].id : undefined
      );

      return {
        messages,
        hasMore: dbResult.hasMore,
        nextCursor: messages.length > 0 ? messages[0].id : undefined,
      };
    }

    // Subsequent pages - get from database
    return await this.dbService.getMessagesFromDB(roomId, limit, before);
  }

  // Multi-room presence methods
  async setUserOnlineInRooms(userId: string, username: string): Promise<void> {
    log.debug("setUserOnlineInRooms");

    const roomIds = await this.dbService.getUserRoomIds(userId);
    await this.redisService.setUserOnline(userId, username, roomIds);
  }

  async setUserOffline(userId: string): Promise<void> {
    log.debug("setUserOffline");
    await this.redisService.setUserOffline(userId);
  }

  async updateUserHeartbeat(userId: string): Promise<void> {
    log.debug("updateUserHeartbeat");
    await this.redisService.updateUserHeartbeat(userId);
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    log.debug("getUserPresence");
    return await this.redisService.getUserPresence(userId);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    log.debug("getUserSocket");
    return await this.redisService.getUserSocket(userId);
  }

  async getRoomPresences(roomId: string): Promise<UserPresence[]> {
    log.debug("getRoomPresences");
    return await this.redisService.getRoomPresences(roomId);
  }

  // Cache management methods
  async preloadRoomCache(roomId: string): Promise<void> {
    log.debug("preloadRoomCache");
    try {
      // Check if cache exists
      const hasCache = await this.redisService.hasRecentMessages(roomId);

      if (!hasCache) {
        // Load recent messages from DB and populate cache
        const recentMessages = await this.dbService.getRecentMessagesFromDB(
          roomId,
          100
        );
        for (let i = 0; i < recentMessages.length; i++) {
          await this.redisService.storeMessageInCache(
            roomId,
            recentMessages[i]
          );
        }
      }
    } catch (error) {
      log.error(error, `Error preloading cache for room ${roomId}:`);
    }
  }

  async clearRoomCache(roomId: string): Promise<void> {
    log.debug("clearRoomCache");
    await this.redisService.clearRoomCache(roomId);
  }

  async bumpActivity(userId: string, username: string): Promise<void> {
    await this.redisService.updateUserHeartbeat(userId);

    const presence = await this.redisService.getUserPresence(userId);
    if (!presence || presence.status !== "online") {
      // User was offline due to idle -> bring them back online and notify
      await this.setUserOnlineInRooms(userId, username);

      const roomIds = await this.dbService.getUserRoomIds(userId);
      for (const roomId of roomIds) {
        const presences = await this.redisService.getRoomPresences(roomId);
        this.io.to(roomId).emit("room_update", {
          type: "user_connected",
          roomId,
          presences,
        });
      }
    }
  }

  private async cleanupStaleUsers(): Promise<void> {
    log.debug("cleanupStaleUsers");
    try {
      const staleUsers = await this.redisService.cleanupStaleUsers();

      for (const userId of staleUsers) {
        const presence = await this.redisService.getUserPresence(userId);
        if (presence) {
          // Notify all active rooms about user going offline
          for (const roomId of presence.activeRooms) {
            const roomPresences = await this.redisService.getRoomPresences(
              roomId
            );
            this.io.to(roomId).emit("room_update", {
              type: "user_disconnected",
              roomId,
              presences: roomPresences,
            });
          }
        }
      }
    } catch (error) {
      log.error(error, "Error during stale user cleanup");
    }
  }

  async disconnect(): Promise<void> {
    log.debug("disconnect");
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
