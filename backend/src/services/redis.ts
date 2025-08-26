import Redis from "ioredis";
import { UserPresence, Message } from "../utils/types";
import { logger } from "../utils/logger";
const log = logger.child({ mod: "redis" });

export class RedisService {
  private redis: Redis;
  private readonly RECENT_MESSAGE_LIMIT = 100; // Keep 100 recent messages in Redis
  private readonly MESSAGE_EXPIRE_SECONDS = 86400; // Messages expire from Redis after 24 hours

  constructor() {
    const redisUrl =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || "redis"}:${
        process.env.REDIS_PORT || "6379"
      }`;

    this.redis = new Redis(redisUrl);

    this.redis.on("connect", () => {
      log.info("Connected to Redis");
    });

    this.redis.on("error", (err) => {
      log.error(err, "Redis connection error");
    });
  }

  // Message storage operations
  async storeMessageInCache(roomId: string, message: Message): Promise<void> {
    log.debug("storeMessageInCache");
    const messageKey = `room:${roomId}:messages`;
    const messageData = JSON.stringify(message);

    // Use a pipeline for atomic operations
    const pipeline = this.redis.pipeline();

    // Add message to the beginning of the list (most recent first)
    pipeline.lpush(messageKey, messageData);

    // Keep only the most recent messages
    pipeline.ltrim(messageKey, 0, this.RECENT_MESSAGE_LIMIT - 1);

    // Set expiration on the key
    pipeline.expire(messageKey, this.MESSAGE_EXPIRE_SECONDS);

    await pipeline.exec();
  }

  async getRecentMessagesFromCache(
    roomId: string,
    limit: number = 50
  ): Promise<Message[]> {
    log.debug("getRecentMessagesFromCache");
    const messageKey = `room:${roomId}:messages`;
    const messages = await this.redis.lrange(messageKey, 0, limit - 1);

    return messages.map((msg) => JSON.parse(msg) as Message).reverse(); // Return in chronological order (oldest first)
  }

  async getRecentMessageCount(roomId: string): Promise<number> {
    log.debug("getRecentMessageCount");
    const messageKey = `room:${roomId}:messages`;
    return await this.redis.llen(messageKey);
  }

  async clearRoomCache(roomId: string): Promise<void> {
    log.debug("clearRoomCache");
    const messageKey = `room:${roomId}:messages`;
    await this.redis.del(messageKey);
  }

  // Check if we have recent messages in cache
  async hasRecentMessages(roomId: string): Promise<boolean> {
    log.debug("hasRecentMessages");
    const messageKey = `room:${roomId}:messages`;
    const exists = await this.redis.exists(messageKey);
    return exists === 1;
  }

  // User session operations
  async setUserSession(userId: string, socketId: string): Promise<void> {
    log.debug("setUserSession");
    await this.redis.set(`user:${userId}:socket`, socketId, "EX", 3600);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    log.debug("getUserSocket");
    return await this.redis.get(`user:${userId}:socket`);
  }

  async removeUserSession(userId: string): Promise<void> {
    log.debug("removeUserSession");
    await this.redis.del(`user:${userId}:socket`);
  }

  // Multi-room presence operations
  async setUserPresence(userId: string, presence: UserPresence): Promise<void> {
    log.debug("setUserPresence");
    const presenceKey = `presence:${userId}`;
    await this.redis.hset(presenceKey, {
      userId: presence.userId,
      username: presence.username,
      status: presence.status,
      lastSeen: presence.lastSeen,
      activeRooms: JSON.stringify(presence.activeRooms),
    });
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    log.debug("getUserPresence");
    const presenceKey = `presence:${userId}`;
    const data = await this.redis.hgetall(presenceKey);

    if (!data.userId) {
      return null;
    }

    return {
      userId: data.userId,
      username: data.username,
      status: data.status as "online" | "offline",
      lastSeen: data.lastSeen,
      activeRooms: JSON.parse(data.activeRooms || "[]"),
    };
  }

  // Room operations
  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    log.debug("addUserToRoom");
    // Add to room set
    await this.redis.sadd(`room:${roomId}:users`, userId);

    // Update user's active rooms
    const presence = await this.getUserPresence(userId);
    if (presence) {
      const activeRooms = [...new Set([...presence.activeRooms, roomId])];
      await this.setUserPresence(userId, { ...presence, activeRooms });
    }
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    log.debug("removeUserFromRoom");
    // Remove from room set
    await this.redis.srem(`room:${roomId}:users`, userId);

    // Update user's active rooms
    const presence = await this.getUserPresence(userId);
    if (presence) {
      const activeRooms = presence.activeRooms.filter((id) => id !== roomId);
      await this.setUserPresence(userId, { ...presence, activeRooms });
    }
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    log.debug("getRoomUsers");
    return await this.redis.smembers(`room:${roomId}:users`);
  }

  async setUserOnline(
    userId: string,
    username: string,
    activeRooms: string[] = []
  ): Promise<void> {
    log.debug("setUserOnline");
    const presence: UserPresence = {
      userId,
      username,
      status: "online",
      lastSeen: new Date().toISOString(),
      activeRooms,
    };

    await this.setUserPresence(userId, presence);
    await this.redis.sadd("online_users", userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    log.debug("setUserOffline");
    const currentPresence = await this.getUserPresence(userId);
    if (currentPresence) {
      currentPresence.status = "offline";
      currentPresence.lastSeen = new Date().toISOString();
      await this.setUserPresence(userId, currentPresence);
    }

    await this.redis.srem("online_users", userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    log.debug("getOnlineUsers");
    return await this.redis.smembers("online_users");
  }

  async getRoomPresences(roomId: string): Promise<UserPresence[]> {
    log.debug("getRoomPresences");
    const userIds = await this.getRoomUsers(roomId);
    const presences: UserPresence[] = [];

    for (const userId of userIds) {
      const presence = await this.getUserPresence(userId);
      if (presence) {
        presences.push(presence);
      }
    }

    return presences;
  }

  // Heartbeat operations
  async updateUserHeartbeat(userId: string): Promise<void> {
    log.debug("updateUserHeartbeat");
    const heartbeatKey = `heartbeat:${userId}`;
    await this.redis.set(heartbeatKey, Date.now(), "EX", 30); // 30 seconds
  }

  async getUserHeartbeat(userId: string): Promise<number | null> {
    log.debug("getUserHeartbeat");
    const heartbeatKey = `heartbeat:${userId}`;
    const timestamp = await this.redis.get(heartbeatKey);
    return timestamp ? parseInt(timestamp) : null;
  }

  async cleanupStaleUsers(): Promise<string[]> {
    log.debug("cleanupStaleUsers");

    const onlineUsers = await this.getOnlineUsers();
    const staleUsers: string[] = [];
    const now = Date.now();

    for (const userId of onlineUsers) {
      const lastHeartbeat = await this.getUserHeartbeat(userId);
      if (!lastHeartbeat || now - lastHeartbeat > 180000) {
        // 3 minutes stale
        staleUsers.push(userId);
        await this.setUserOffline(userId);
      }
    }

    return staleUsers;
  }

  async disconnect(): Promise<void> {
    log.debug("disconnect");
    await this.redis.disconnect();
  }
}
