import { v4 as uuidv4 } from "uuid";
import { RedisService, UserPresence } from "./redis";
import type { Server } from "socket.io";

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  type: "text" | "system";
}

export interface User {
  id: string;
  username: string;
  socketId: string;
}

export interface RoomUser extends User {
  presence: UserPresence;
}

export class ChatService {
  private redisService: RedisService;
  private io: Server;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(redisService: RedisService, io: Server) {
    this.redisService = redisService;
    this.io = io;

    // Start heartbeat cleanup process
    this.heartbeatInterval = setInterval(async () => {
      await this.cleanupStaleUsers();
    }, 30000); // Check every 30 seconds
  }

  async createMessage(
    roomId: string,
    userId: string,
    username: string,
    content: string,
    type: "text" | "system" = "text"
  ): Promise<Message> {
    const message: Message = {
      id: uuidv4(),
      roomId,
      userId,
      username,
      content,
      timestamp: new Date().toISOString(),
      type,
    };

    // Store message in Redis
    await this.redisService.storeMessage(roomId, message);

    // Publish message to room channel for real-time distribution
    // await this.redisService.publishMessage(`room:${roomId}`, {
    //   type: "new_message",
    //   message,
    // });

    // Emit once; adapter fans out cluster-wide
    this.io.to(roomId).emit("room_update", { type: "new_message", message });

    return message;
  }

  async getRecentMessages(roomId: string): Promise<Message[]> {
    return await this.redisService.getRecentMessages(roomId);
  }

  async joinRoom(roomId: string, user: User): Promise<void> {
    // Add user to room
    await this.redisService.addUserToRoom(roomId, user.id);

    // Store user session
    await this.redisService.setUserSession(user.id, user.socketId);

    // Set user online presence
    await this.redisService.setUserOnline(user.id, user.username, roomId);

    // Update heartbeat
    await this.redisService.updateUserHeartbeat(user.id);

    // Create system message for user joining
    await this.createMessage(
      roomId,
      "system",
      "System",
      `${user.username} joined the room`,
      "system"
    );

    // Get updated room presences
    const presences = await this.redisService.getRoomPresences(roomId);

    // Publish room update with presence info
    // await this.redisService.publishMessage(`room:${roomId}`, {
    //   type: "user_joined",
    //   user,
    //   presences,
    // });

    // Room-scoped presence update
    this.io
      .to(roomId)
      .emit("room_update", { type: "user_joined", user, presences });

    // Publish global presence update
    // await this.redisService.publishMessage("presence", {
    //   type: "user_online",
    //   userId: user.id,
    //   username: user.username,
    //   roomId,
    // });

    // Global presence stream (optional)
    this.io.emit("presence_update", {
      type: "user_online",
      userId: user.id,
      username: user.username,
      roomId,
    });
  }

  async leaveRoom(roomId: string, user: User): Promise<void> {
    // Remove user from room
    await this.redisService.removeUserFromRoom(roomId, user.id);

    // Set user offline
    await this.redisService.setUserOffline(user.id);

    // Remove user session
    await this.redisService.removeUserSession(user.id);

    // Create system message for user leaving
    await this.createMessage(
      roomId,
      "system",
      "System",
      `${user.username} left the room`,
      "system"
    );

    // Get updated room presences
    const presences = await this.redisService.getRoomPresences(roomId);

    // Publish room update with presence info
    // await this.redisService.publishMessage(`room:${roomId}`, {
    //   type: "user_left",
    //   user,
    //   presences,
    // });

    this.io
      .to(roomId)
      .emit("room_update", { type: "user_left", user, presences });

    // Publish global presence update
    // await this.redisService.publishMessage("presence", {
    //   type: "user_offline",
    //   userId: user.id,
    //   username: user.username,
    // });
    this.io.emit("presence_update", {
      type: "user_offline",
      userId: user.id,
      username: user.username,
    });
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return await this.redisService.getRoomUsers(roomId);
  }

  async getRoomPresences(roomId: string): Promise<UserPresence[]> {
    return await this.redisService.getRoomPresences(roomId);
  }

  public async setUserOnline(
    userId: string,
    username: string,
    roomId: string
  ): Promise<void> {
    await this.redisService.setUserOnline(userId, username, roomId);
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.redisService.setUserOffline(userId);
  }

  async updateUserHeartbeat(userId: string): Promise<void> {
    await this.redisService.updateUserHeartbeat(userId);
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    return await this.redisService.getUserPresence(userId);
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return await this.redisService.getUserSocket(userId);
  }

  // async subscribeToRoom(
  //   roomId: string,
  //   callback: (data: any) => void
  // ): Promise<void> {
  //   await this.redisService.subscribe(`room:${roomId}`, callback);
  // }

  // async subscribeToPresence(callback: (data: any) => void): Promise<void> {
  //   await this.redisService.subscribe("presence", callback);
  // }

  // async unsubscribeFromRoom(roomId: string): Promise<void> {
  //   await this.redisService.unsubscribe(`room:${roomId}`);
  // }

  // async unsubscribeFromPresence(): Promise<void> {
  //   await this.redisService.unsubscribe("presence");
  // }

  private async cleanupStaleUsers(): Promise<void> {
    try {
      const staleUsers = await this.redisService.cleanupStaleUsers();

      // Notify rooms about users going offline
      for (const userId of staleUsers) {
        const presence = await this.redisService.getUserPresence(userId);
        if (presence?.roomId) {
          // await this.redisService.publishMessage(`room:${presence.roomId}`, {
          //   type: "user_disconnected",
          //   userId,
          //   username: presence.username,
          // });
          this.io.to(presence.roomId).emit("room_update", {
            type: "user_disconnected",
            userId,
            username: presence.username,
          });
        }

        // Publish global presence update
        // await this.redisService.publishMessage("presence", {
        //   type: "user_offline",
        //   userId,
        //   username: presence?.username || "Unknown",
        // });
        this.io.emit("presence_update", {
          type: "user_offline",
          userId,
          username: presence?.username || "Unknown",
        });
      }
    } catch (error) {
      console.error("Error during stale user cleanup:", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
