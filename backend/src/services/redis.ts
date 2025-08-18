import Redis from "ioredis";

export interface UserPresence {
  userId: string;
  username: string;
  status: "online" | "offline";
  lastSeen: string;
  roomId?: string; // why need this?
}

export class RedisService {
  private redis: Redis;
  // private subscriber: Redis;
  // private publisher: Redis;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "3002"),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    };

    this.redis = new Redis(redisConfig);
    // this.subscriber = new Redis(redisConfig);
    // this.publisher = new Redis(redisConfig);

    this.redis.on("connect", () => {
      console.log("Connected to Redis");
    });

    this.redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }

  // Message storage operations
  async storeMessage(roomId: string, message: any): Promise<void> {
    const messageKey = `room:${roomId}:messages`;
    await this.redis.lpush(messageKey, JSON.stringify(message));
    // Keep only last 100 messages per room
    await this.redis.ltrim(messageKey, 0, 99);
  }

  async getRecentMessages(roomId: string, limit: number = 50): Promise<any[]> {
    const messageKey = `room:${roomId}:messages`;
    const messages = await this.redis.lrange(messageKey, 0, limit - 1);
    return messages.map((msg) => JSON.parse(msg)).reverse();
  }

  // Room operations
  async addUserToRoom(roomId: string, userId: string): Promise<void> {
    await this.redis.sadd(`room:${roomId}:users`, userId);
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    await this.redis.srem(`room:${roomId}:users`, userId);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return await this.redis.smembers(`room:${roomId}:users`);
  }

  // User session operations
  async setUserSession(userId: string, socketId: string): Promise<void> {
    await this.redis.set(`user:${userId}:socket`, socketId, "EX", 3600);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return await this.redis.get(`user:${userId}:socket`);
  }

  async removeUserSession(userId: string): Promise<void> {
    await this.redis.del(`user:${userId}:socket`);
  }

  // User presence operations
  async setUserPresence(userId: string, presence: UserPresence): Promise<void> {
    const presenceKey = `presence:${userId}`;
    await this.redis.hset(presenceKey, {
      userId: presence.userId,
      username: presence.username,
      status: presence.status,
      lastSeen: presence.lastSeen,
      roomId: presence.roomId || "",
    });

    // Set expiration for presence data
    await this.redis.expire(presenceKey, 300); // 5 minutes
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
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
      roomId: data.roomId || undefined,
    };
  }

  async setUserOnline(
    userId: string,
    username: string,
    roomId?: string
  ): Promise<void> {
    const presence: UserPresence = {
      userId,
      username,
      status: "online",
      lastSeen: new Date().toISOString(),
      roomId,
    };

    await this.setUserPresence(userId, presence);
    await this.redis.sadd("online_users", userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    const currentPresence = await this.getUserPresence(userId);
    if (currentPresence) {
      currentPresence.status = "offline";
      currentPresence.lastSeen = new Date().toISOString();
      await this.setUserPresence(userId, currentPresence);
    }

    await this.redis.srem("online_users", userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    return await this.redis.smembers("online_users");
  }

  async getRoomPresences(roomId: string): Promise<UserPresence[]> {
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
    const heartbeatKey = `heartbeat:${userId}`;
    await this.redis.set(heartbeatKey, Date.now(), "EX", 30); // 30 seconds
  }

  async getUserHeartbeat(userId: string): Promise<number | null> {
    const heartbeatKey = `heartbeat:${userId}`;
    const timestamp = await this.redis.get(heartbeatKey);
    return timestamp ? parseInt(timestamp) : null;
  }

  async cleanupStaleUsers(): Promise<string[]> {
    const onlineUsers = await this.getOnlineUsers();
    const staleUsers: string[] = [];
    const now = Date.now();

    for (const userId of onlineUsers) {
      const lastHeartbeat = await this.getUserHeartbeat(userId);
      if (!lastHeartbeat || now - lastHeartbeat > 60000) {
        // 1 minute stale
        staleUsers.push(userId);
        await this.setUserOffline(userId);
      }
    }

    return staleUsers;
  }

  // Pub/Sub operations
  // async publishMessage(channel: string, message: any): Promise<void> {
  //   await this.publisher.publish(channel, JSON.stringify(message));
  // }

  // async subscribe(
  //   channel: string,
  //   callback: (message: any) => void
  // ): Promise<void> {
  //   await this.subscriber.subscribe(channel);
  //   this.subscriber.on("message", (receivedChannel, message) => {
  //     if (receivedChannel === channel) {
  //       try {
  //         const parsedMessage = JSON.parse(message);
  //         callback(parsedMessage);
  //       } catch (error) {
  //         console.error("Error parsing message:", error);
  //       }
  //     }
  //   });
  // }

  // async unsubscribe(channel: string): Promise<void> {
  //   await this.subscriber.unsubscribe(channel);
  // }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    // await this.subscriber.disconnect();
    // await this.publisher.disconnect();
  }
}
