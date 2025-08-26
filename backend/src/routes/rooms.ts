import { Router } from "express";
import { ChatService } from "../services/chat";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  CreateRoomRequest,
  JoinRoomRequest,
  MessagePaginationRequest,
} from "../utils/types";

export function createRoomRoutes(chatService: ChatService) {
  const router = Router();

  const sendError = (
    res: any,
    status: number,
    message: string,
    code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "PASSCODE_REQUIRED"
      | "DUPLICATE_ROOM_NAME"
      | "GENERIC"
  ) => res.status(status).json({ error: { message, code } });

  // Get public rooms
  router.get("/public", async (req: AuthenticatedRequest, res) => {
    req.log.debug("rooms/public");

    try {
      if (!req.user) {
        const rooms = await chatService.getPublicRooms();
        return res.json({ rooms });
      } else {
        const rooms = await chatService.getPublicRooms(req.user.id);
        return res.json({ rooms });
      }
    } catch (error) {
      req.log.error(error, "Get public rooms error");
      return sendError(res, 500, "Failed to fetch rooms", "GENERIC");
    }
  });

  // Get user's rooms
  router.get("/my-rooms", async (req: AuthenticatedRequest, res) => {
    req.log.debug("rooms/my-rooms");
    try {
      if (!req.user) {
        return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
      }

      const rooms = await chatService.getUserRooms(req.user.id);
      res.json({ rooms });
    } catch (error) {
      req.log.error(error, "Get user rooms error");
      return sendError(res, 500, "Failed to fetch user rooms", "GENERIC");
    }
  });

  // Create room
  router.post("/create", async (req: AuthenticatedRequest, res) => {
    req.log.debug("rooms/create");
    try {
      if (!req.user) {
        return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
      }

      const roomData: CreateRoomRequest = req.body;

      if (!roomData.name || roomData.name.trim().length === 0) {
        return sendError(res, 400, "Room name is required", "VALIDATION_ERROR");
      }

      if (roomData.isPrivate && !roomData.passcode) {
        return sendError(
          res,
          400,
          "Passcode is required for private rooms",
          "PASSCODE_REQUIRED"
        );
      }

      const room = await chatService.createRoom(roomData, req.user.id);
      res.status(201).json({ room });
    } catch (error) {
      req.log.error(error, "Create room error");
      if ((error as any).code === "23505") {
        return sendError(
          res,
          409,
          "Room name already exists",
          "DUPLICATE_ROOM_NAME"
        );
      }
      return sendError(res, 500, "Failed to create room", "GENERIC");
    }
  });

  // Join room
  router.post("/join", async (req: AuthenticatedRequest, res) => {
    req.log.debug("rooms/join");
    try {
      if (!req.user) {
        return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
      }

      const joinData: JoinRoomRequest = req.body;

      if (!joinData.roomId) {
        return sendError(res, 400, "Room ID is required", "VALIDATION_ERROR");
      }

      const result = await chatService.joinRoom(req.user.id, joinData);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ room: result.room, alreadyJoined: result.alreadyJoined });
    } catch (error) {
      req.log.error(error, "Join room error");
      return sendError(res, 500, "Failed to join room", "GENERIC");
    }
  });

  // Leave room
  router.post("/:roomId/leave", async (req: AuthenticatedRequest, res) => {
    req.log.debug("rooms/:roomId/leave");
    try {
      if (!req.user) {
        return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
      }

      const { roomId } = req.params;
      await chatService.leaveRoom(req.user.id, roomId);

      res.json({ success: true });
    } catch (error) {
      req.log.error(error, "Leave room error");
      return sendError(res, 500, "Failed to leave room", "GENERIC");
    }
  });

  // Get room messages with pagination
  // router.get("/:roomId/messages", async (req: AuthenticatedRequest, res) => {
  //   req.log.debug("rooms/:roomId/messages");
  //   try {
  //     if (!req.user) {
  //       return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
  //     }

  //     const { roomId } = req.params;
  //     const { limit, before } = req.query;

  //     const request: MessagePaginationRequest = {
  //       roomId,
  //       limit: limit ? parseInt(limit as string) : undefined,
  //       before: before as string | undefined,
  //     };

  //     const result = await chatService.getMessages(request);
  //     res.json(result);
  //   } catch (error) {
  //     req.log.error(error, "Get messages error");
  //     return sendError(res, 500, "Failed to fetch messages", "GENERIC");
  //   }
  // });

  // Preload room cache (admin endpoint)
  // router.post(
  //   "/:roomId/preload-cache",
  //   async (req: AuthenticatedRequest, res) => {
  //     req.log.debug("rooms/:roomId/preload-cache");
  //     try {
  //       if (!req.user) {
  //         return sendError(res, 401, "Unauthorized", "UNAUTHORIZED");
  //       }

  //       const { roomId } = req.params;
  //       await chatService.preloadRoomCache(roomId);
  //       res.json({ success: true, message: "Cache preloaded successfully" });
  //     } catch (error) {
  //       req.log.error(error, "Preload cache error");
  //       return sendError(res, 500, "Failed to preload cache", "GENERIC");
  //     }
  //   }
  // );

  return router;
}
