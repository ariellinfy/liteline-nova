import { Server, Socket } from "socket.io";
import { ChatService, User } from "../services/chat";

export function socketHandler(io: Server, chatService: ChatService) {
  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    let currentUser: User | null = null;
    let currentRoom: string | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Handle user joining a room
    socket.on(
      "join_room",
      async (data: { roomId: string; userId: string; username: string }) => {
        try {
          const { roomId, userId, username } = data;
          console.log("join room", data);

          // Leave current room if in one
          if (currentRoom && currentUser) {
            socket.leave(currentRoom);
            await chatService.leaveRoom(currentRoom, currentUser);
            // await chatService.unsubscribeFromRoom(currentRoom);
          }

          // Join new room
          currentUser = { id: userId, username, socketId: socket.id };
          currentRoom = roomId;

          socket.join(roomId);
          await chatService.joinRoom(roomId, currentUser);

          // Subscribe to room updates
          // await chatService.subscribeToRoom(roomId, (data) => {
          //   io.to(roomId).emit("room_update", data);
          // });

          // Subscribe to presence updates
          // await chatService.subscribeToPresence((data) => {
          //   socket.emit("presence_update", data);
          // });

          // Start heartbeat for presence
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }

          heartbeatInterval = setInterval(async () => {
            if (currentUser) {
              await chatService.updateUserHeartbeat(currentUser.id);
            }
          }, 15000); // Update every 15 seconds

          // Send recent messages to the user
          const recentMessages = await chatService.getRecentMessages(roomId);
          socket.emit("recent_messages", recentMessages);

          // Get current room presences
          const presences = await chatService.getRoomPresences(roomId);
          socket.emit("room_joined", { roomId, presences });
        } catch (error) {
          console.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      }
    );

    // Handle sending messages
    socket.on("send_message", async (data: { content: string }) => {
      try {
        if (!currentUser || !currentRoom) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const { content } = data;

        console.log("send message", content);
        if (!content.trim()) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        // Update heartbeat on message send
        await chatService.updateUserHeartbeat(currentUser.id);

        await chatService.createMessage(
          currentRoom,
          currentUser.id,
          currentUser.username,
          content.trim()
        );
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicators
    socket.on("typing_start", async () => {
      if (currentRoom && currentUser) {
        // Update heartbeat on typing
        await chatService.updateUserHeartbeat(currentUser.id);

        socket.to(currentRoom).emit("user_typing", {
          userId: currentUser.id,
          username: currentUser.username,
          isTyping: true,
        });
      }
    });

    socket.on("typing_stop", () => {
      if (currentRoom && currentUser) {
        socket.to(currentRoom).emit("user_typing", {
          userId: currentUser.id,
          username: currentUser.username,
          isTyping: false,
        });
      }
    });

    // Handle heartbeat pings
    socket.on("heartbeat", async () => {
      if (currentUser) {
        await chatService.updateUserHeartbeat(currentUser.id);
        socket.emit("heartbeat_ack");
      }
    });

    // Handle presence status updates
    socket.on(
      "update_presence",
      async (data: { status: "online" | "offline" }) => {
        if (currentUser && currentRoom) {
          try {
            if (data.status === "online") {
              await chatService.setUserOnline(
                currentUser.id,
                currentUser.username,
                currentRoom
              );
            } else {
              await chatService.setUserOffline(currentUser.id);
            }

            // Notify room about presence change
            const presences = await chatService.getRoomPresences(currentRoom);
            io.to(currentRoom).emit("presence_updated", { presences });
          } catch (error) {
            console.error("Error updating presence:", error);
          }
        }
      }
    );

    // Handle get room presences request
    socket.on("get_room_presences", async () => {
      if (currentRoom) {
        try {
          const presences = await chatService.getRoomPresences(currentRoom);
          socket.emit("room_presences", { presences });
        } catch (error) {
          console.error("Error getting room presences:", error);
          socket.emit("error", { message: "Failed to get room presences" });
        }
      }
    });

    // Handle disconnection
    socket.on("disconnect", async (reason) => {
      console.log("User disconnected:", socket.id, "Reason:", reason);

      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      try {
        if (currentRoom && currentUser) {
          await chatService.leaveRoom(currentRoom, currentUser);
          // await chatService.unsubscribeFromRoom(currentRoom);
          // await chatService.unsubscribeFromPresence();
        }
      } catch (error) {
        console.error("Error handling disconnection:", error);
      }
    });

    // Handle leave room
    socket.on("leave_room", async () => {
      try {
        if (currentRoom && currentUser) {
          // Clear heartbeat interval
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }

          socket.leave(currentRoom);
          await chatService.leaveRoom(currentRoom, currentUser);
          // await chatService.unsubscribeFromRoom(currentRoom);
          // await chatService.unsubscribeFromPresence();

          currentRoom = null;
          currentUser = null;

          socket.emit("room_left");
        }
      } catch (error) {
        console.error("Error leaving room:", error);
        socket.emit("error", { message: "Failed to leave room" });
      }
    });
  });
}
