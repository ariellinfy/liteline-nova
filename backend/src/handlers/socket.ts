import { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat";
import { User, MessagePaginationRequest } from "../types";

export function socketHandler(io: Server, chatService: ChatService) {
  io.on("connection", async (socket: Socket) => {
    const user: User = socket.user; // Set by auth middleware

    // Connect initialization
    await handleUserConnect();

    // Handle joining a room
    socket.on(
      "join_room",
      async (data: { roomId: string; alreadyJoined: boolean }) => {
        console.log("J10 C9 socket/join_room");
        try {
          const { roomId, alreadyJoined } = data;

          // Join socket room
          socket.join(roomId);

          // Update user's online status with all active rooms
          await chatService.setUserOnlineInRooms(user.id, user.username);

          if (!alreadyJoined) {
            // Preload cache for this room
            await chatService.preloadRoomCache(roomId);

            // Create system message
            await chatService.createMessage(
              roomId,
              user.id,
              `${user.username} joined the room`,
              "system"
            );
          }

          // Get current room presences & notify user of successful join
          const presences = await chatService.getRoomPresences(roomId);

          // Notify user of successful join
          socket.emit("room_joined", { roomId, presences });
          // Notify others in the room
          !alreadyJoined &&
            socket.to(roomId).emit("room_update", {
              type: "user_joined",
              roomId,
              presences,
            });

          // Send recent messages to the user
          // const recentMessages = await chatService.getRecentMessages(roomId);
          // socket.emit("recent_messages", { roomId, messages: recentMessages });
          const firstPage = await chatService.getMessages({
            roomId,
            limit: 50,
          });
          socket.emit("recent_messages", {
            roomId,
            messages: firstPage.messages,
            hasMore: firstPage.hasMore,
            nextCursor: firstPage.nextCursor,
          });
        } catch (error) {
          console.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      }
    );

    // Handle leaving a room
    socket.on("leave_room", async (data: { roomId: string }) => {
      console.log("L6 socket/leave_room");
      try {
        const { roomId } = data;

        // Leave socket room
        socket.leave(roomId);

        // Update user's online status
        await chatService.setUserOnlineInRooms(user.id, user.username);

        // Create system message
        await chatService.createMessage(
          roomId,
          user.id,
          `${user.username} left the room`,
          "system"
        );

        // Get updated presences
        const presences = await chatService.getRoomPresences(roomId);

        // Notify user of successful leave
        socket.emit("room_left", { roomId });

        // Notify others in the room
        socket.to(roomId).emit("room_update", {
          type: "user_left",
          roomId,
          presences,
        });
      } catch (error) {
        console.error("Error leaving room:", error);
        socket.emit("error", { message: "Failed to leave room" });
      }
    });

    // Handle sending messages
    socket.on(
      "send_message",
      async (data: { roomId: string; content: string }) => {
        console.log("M3 socket/send_message");
        try {
          const { roomId, content } = data;

          if (!content.trim()) {
            socket.emit("error", { message: "Message cannot be empty" });
            return;
          }

          // Update heartbeat on message send
          await chatService.bumpActivity(user.id, user.username);

          // Create message (stored in both PostgreSQL and Redis)
          await chatService.createMessage(roomId, user.id, content.trim());
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    // Handle loading more messages (pagination)
    socket.on("load_more_messages", async (data: MessagePaginationRequest) => {
      console.log("socket/load_more_messages");
      try {
        const { roomId, limit = 50, before } = data;

        const result = await chatService.getMessages({ roomId, limit, before });

        socket.emit("more_messages_loaded", {
          roomId,
          messages: result.messages,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        console.error("Error loading more messages:", error);
        socket.emit("error", { message: "Failed to load more messages" });
      }
    });

    // Handle typing indicators
    socket.on("typing_start", async (data: { roomId: string }) => {
      console.log("socket/typing_start");
      const { roomId } = data;

      await chatService.bumpActivity(user.id, user.username);

      socket.to(roomId).emit("user_typing", {
        userId: user.id,
        username: user.username,
        roomId,
        isTyping: true,
      });
    });

    socket.on("typing_stop", (data: { roomId: string }) => {
      console.log("socket/typing_stop");
      const { roomId } = data;

      socket.to(roomId).emit("user_typing", {
        userId: user.id,
        username: user.username,
        roomId,
        isTyping: false,
      });
    });

    // Handle manual heartbeat
    socket.on("heartbeat", async () => {
      console.log("socket/heartbeat");
      try {
        await chatService.bumpActivity(user.id, user.username);
        socket.emit("heartbeat_ack");
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    });

    // Handle get room presences
    socket.on("get_room_presences", async (data: { roomId: string }) => {
      console.log("socket/get_room_presences");
      try {
        const { roomId } = data;
        const presences = await chatService.getRoomPresences(roomId);
        socket.emit("room_presences", { roomId, presences });
      } catch (error) {
        console.error("Error getting room presences:", error);
        socket.emit("error", { message: "Failed to get room presences" });
      }
    });

    // Handle get user's rooms
    socket.on("get_my_rooms", async () => {
      console.log("socket/get_my_rooms");
      try {
        const rooms = await chatService.getUserRooms(user.id);
        socket.emit("my_rooms", { rooms });
      } catch (error) {
        console.error("Error getting user rooms:", error);
        socket.emit("error", { message: "Failed to get rooms" });
      }
    });

    // Handle connection
    async function handleUserConnect() {
      console.log("socket/connect");
      console.log("User connect:", socket.id);

      // Set user online
      await chatService.setUserOnlineInRooms(user.id, user.username);
      const roomIds = await chatService.getUserRoomIds(user.id);

      try {
        for (const roomId of roomIds) {
          // Notify room members
          const presences = await chatService.getRoomPresences(roomId);
          socket.to(roomId).emit("room_update", {
            type: "user_connected",
            roomId,
            presences,
          });
        }
      } catch (error) {
        console.error("Error handling connection:", error);
      }
    }

    // Handle disconnection
    socket.on("disconnect", async (reason) => {
      console.log("socket/disconnect");
      console.log("User disconnected:", socket.id, "Reason:", reason);

      // Set user offline
      await chatService.setUserOffline(user.id);
      const roomIds = await chatService.getUserRoomIds(user.id);

      try {
        for (const roomId of roomIds) {
          // Notify room members
          const presences = await chatService.getRoomPresences(roomId);
          socket.to(roomId).emit("room_update", {
            type: "user_disconnected",
            roomId,
            presences,
          });
        }
      } catch (error) {
        console.error("Error handling disconnection:", error);
      }
    });
  });
}
