import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

import { RedisService } from "./services/redis";
import { ChatService } from "./services/chat";
import { socketHandler } from "./handlers/socket";
import { buildApp } from "./app";

const app = buildApp();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

// Redis adapter clients
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = parseInt(process.env.REDIS_PORT || "3002", 10);
const pubClient = new Redis({ host: redisHost, port: redisPort });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// Initialize services
const redisService = new RedisService();
const chatService = new ChatService(redisService, io);

// Socket.io connection handling
socketHandler(io, chatService);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io server ready for connections`);
});

// Export for potential manual teardown in e2e tests (optional)
export { server, io };
