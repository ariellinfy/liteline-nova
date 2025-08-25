import { Router } from "express";
import { ChatService } from "../services/chat";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  CreateRoomRequest,
  JoinRoomRequest,
  MessagePaginationRequest,
} from "../types";

export function createRoomRoutes(chatService: ChatService) {
  const router = Router();

  // Get public rooms
  router.get("/public", async (req: AuthenticatedRequest, res) => {
    console.log("routes/rooms/public");

    try {
      if (!req.user) {
        const rooms = await chatService.getPublicRooms();
        return res.json({ rooms });
      } else {
        const rooms = await chatService.getPublicRooms(req.user.id);
        return res.json({ rooms });
      }
    } catch (error) {
      console.error("Get public rooms error:", error);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  // Get user's rooms
  router.get("/my-rooms", async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const rooms = await chatService.getUserRooms(req.user.id);
      console.log("routes/rooms/my-rooms");
      res.json({ rooms });
    } catch (error) {
      console.error("Get user rooms error:", error);
      res.status(500).json({ error: "Failed to fetch user rooms" });
    }
  });

  // Create room
  router.post("/create", async (req: AuthenticatedRequest, res) => {
    console.log("C3 routes/rooms/create");
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } });
      }

      const roomData: CreateRoomRequest = req.body;

      if (!roomData.name || roomData.name.trim().length === 0) {
        return res.status(400).json({
          error: { message: "Room name is required", code: "VALIDATION_ERROR" },
        });
      }

      if (roomData.isPrivate && !roomData.passcode) {
        return res.status(400).json({
          error: {
            message: "Passcode is required for private rooms",
            code: "PASSCODE_REQUIRED",
          },
        });
      }

      const room = await chatService.createRoom(roomData, req.user.id);
      res.status(201).json({ room });
    } catch (error) {
      console.error("Create room error:", error);
      if ((error as any).code === "23505") {
        return res.status(409).json({
          error: {
            message: "Room name already exists",
            code: "DUPLICATE_ROOM_NAME",
          },
        });
      }
      res
        .status(500)
        .json({ error: { message: "Failed to create room", code: "GENERIC" } });
    }
  });

  // Join room
  router.post("/join", async (req: AuthenticatedRequest, res) => {
    console.log("J3 routes/rooms/join");
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } });
      }

      const joinData: JoinRoomRequest = req.body;

      if (!joinData.roomId) {
        return res.status(400).json({
          error: { message: "Room ID is required", code: "VALIDATION_ERROR" },
        });
      }

      const result = await chatService.joinRoom(req.user.id, joinData);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ room: result.room, alreadyJoined: result.alreadyJoined });
    } catch (error) {
      console.error("Join room error:", error);
      res.status(500).json({ error });
    }
  });

  // Leave room
  router.post("/:roomId/leave", async (req: AuthenticatedRequest, res) => {
    console.log("L3 routes/rooms/leave");
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } });
      }

      const { roomId } = req.params;
      await chatService.leaveRoom(req.user.id, roomId);

      res.json({ success: true });
    } catch (error) {
      console.error("Leave room error:", error);
      res.status(500).json({ error: "Failed to leave room" });
    }
  });

  // Get room messages with pagination
  // router.get("/:roomId/messages", async (req: AuthenticatedRequest, res) => {
  //   try {
  //     if (!req.user) {
  //       return res.status(401).json({ error: "Unauthorized" });
  //     }

  //     const { roomId } = req.params;
  //     const { limit, before } = req.query;
  //     console.log(
  //       "routes/rooms/:roomId/messages: roomId, limit, before",
  //       roomId,
  //       limit,
  //       before
  //     );
  //     const request: MessagePaginationRequest = {
  //       roomId,
  //       limit: limit ? parseInt(limit as string) : undefined,
  //       before: before as string | undefined,
  //     };

  //     const result = await chatService.getMessages(request);
  //     console.log("routes/rooms/:roomId/messages: result", result);
  //     res.json(result);
  //   } catch (error) {
  //     console.error("Get messages error:", error);
  //     res.status(500).json({ error: "Failed to fetch messages" });
  //   }
  // });

  // Preload room cache (admin endpoint)
  router.post(
    "/:roomId/preload-cache",
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { roomId } = req.params;
        console.log("routes/rooms/:roomId/preload-cache:roomId", roomId);
        await chatService.preloadRoomCache(roomId);

        res.json({ success: true, message: "Cache preloaded successfully" });
      } catch (error) {
        console.error("Preload cache error:", error);
        res.status(500).json({ error: "Failed to preload cache" });
      }
    }
  );

  return router;
}
