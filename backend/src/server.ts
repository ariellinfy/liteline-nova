import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

import { DatabaseService } from "./services/database";
import { RedisService } from "./services/redis";
import { AuthService } from "./services/auth";
import { ChatService } from "./services/chat";
import { socketHandler } from "./handlers/socket";
import {
  createAuthMiddleware,
  createSocketAuthMiddleware,
} from "./middleware/auth";
import { createAuthRoutes } from "./routes/auth";
import { createRoomRoutes } from "./routes/rooms";
import { buildApp } from "./app";

async function startServer() {
  // Initialize services
  const dbService = new DatabaseService();
  const redisService = new RedisService();
  const authService = new AuthService();

  const app = buildApp();
  const server = createServer(app);

  // Socket.IO setup with Redis adapter
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // Redis adapter clients
  const redisUrl =
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || "redis"}:${
      process.env.REDIS_PORT || "6379"
    }`;
  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  // Initialize services
  const chatService = new ChatService(dbService, redisService, authService, io);

  // Authentication middleware
  const authMiddleware = createAuthMiddleware(authService, dbService);

  // API Routes
  app.use("/api/auth", createAuthRoutes(chatService));
  app.use("/api/rooms", authMiddleware, createRoomRoutes(chatService));

  // Socket.IO authentication middleware
  io.use(createSocketAuthMiddleware(authService, dbService));

  // Socket.IO connection handling
  socketHandler(io, chatService);

  const PORT = process.env.PORT || 3001;

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io server ready for connections`);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");

    await chatService.disconnect();
    await dbService.disconnect();
    await redisService.disconnect();
    await pubClient.quit();
    await subClient.quit();

    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  return { server, io };
}

startServer().catch(console.error);
