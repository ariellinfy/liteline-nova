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
  Error,
} from "../types";

export class ChatService {
  private dbService: DatabaseService;
  private redisService: RedisService;
  private authService: AuthService;
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
      console.log("1 interval cleanupStaleUsers");
      await this.cleanupStaleUsers();
    }, 30000); // Check every 30 seconds
  }

  // Auth methods
  async registerUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    console.log("services/chat/registerUser");
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
    console.log("services/chat/loginUser");
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
    console.log("services/chat/getPublicRooms");
    return await this.dbService.getPublicRooms(userId);
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    console.log("services/chat/getUserRooms", userId);
    return await this.dbService.getUserRooms(userId);
  }

  async getUserRoomIds(userId: string): Promise<string[]> {
    console.log("services/chat/getUserRoomIds", userId);
    return await this.dbService.getUserRoomIds(userId);
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    console.log("J12 services/chat/isUserInRoom");
    return await this.dbService.isUserInRoom(userId, roomId);
  }

  async createRoom(
    request: CreateRoomRequest,
    createdBy: string
  ): Promise<Room> {
    console.log("C4 services/chat/createRoom");
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
    error?: Error;
  }> {
    console.log("J4 services/chat/joinRoom");
    const room = await this.dbService.getRoomByName(request.roomId);
    if (!room) {
      console.log("no room");
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
    console.log("L4 services/chat/leaveRoom", roomId, userId);
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
    console.log("M4 J17 C12 services/chat/createMessage");
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
    console.log("C17 services/chat/getRecentMessages");
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
      console.error("Error getting recent messages:", error);
      // Fallback to database only
      return await this.dbService.getRecentMessagesFromDB(roomId, limit);
    }
  }

  // Paginated message retrieval for loading older messages (need to check logic)
  async getMessages(
    request: MessagePaginationRequest
  ): Promise<MessageResponse> {
    console.log("services/chat/getMessages");
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
    console.log("J11 C10 services/chat/setUserOnlineInRooms");

    const roomIds = await this.dbService.getUserRoomIds(userId);
    await this.redisService.setUserOnline(userId, username, roomIds);

    // for (const id of roomIds) {
    //   await this.redisService.addUserToRoom(userId, id);
    // }
  }

  async setUserOffline(userId: string): Promise<void> {
    console.log("services/chat/setUserOffline");
    await this.redisService.setUserOffline(userId);
  }

  async updateUserHeartbeat(userId: string): Promise<void> {
    console.log("services/chat/updateUserHeartbeat");
    await this.redisService.updateUserHeartbeat(userId);
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    console.log("services/chat/getUserPresence");
    return await this.redisService.getUserPresence(userId);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    console.log("services/chat/getUserSocket");
    return await this.redisService.getUserSocket(userId);
  }

  async getRoomPresences(roomId: string): Promise<UserPresence[]> {
    console.log("J15 C22 services/chat/getRoomPresences");
    return await this.redisService.getRoomPresences(roomId);
  }

  // Cache management methods
  async preloadRoomCache(roomId: string): Promise<void> {
    try {
      console.log("J13 C11 services/chat/preloadRoomCache");
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
      console.error(`Error preloading cache for room ${roomId}:`, error);
    }
  }

  async clearRoomCache(roomId: string): Promise<void> {
    console.log("services/chat/clearRoomCache");
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
    console.log("2 services/chat/cleanupStaleUsers");
    try {
      const staleUsers = await this.redisService.cleanupStaleUsers();
      console.log("staleUsers", staleUsers);
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
      console.error("Error during stale user cleanup:", error);
    }
  }

  async disconnect(): Promise<void> {
    console.log("services/chat/disconnect");
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
