# Liteline-2.0 - Distributed Chat Application

## 📖 Overview
A distributed chat application with real-time messaging, multi-room support, user presence, and message history. Designed for scalability and reliability with a fault-tolerant architecture.

## ✨ Features
- **Real-Time Messaging** – Instant message delivery within chat rooms.  
- **Group Chats** – Create, join, and leave public or private rooms with multiple participants.  
- **User Authentication** – Secure sign up, sign in, and logout functionality.  
- **Presence Indicators** – Online status is broadcast to all rooms a user has joined.  
- **Typing Indicators** – Real-time feedback when participants are typing.  
- **Message History** – Persistent chat history with the ability to revisit past conversations.  
- **Distributed Architecture** – Built on a fault-tolerant, multi-node design with no single point of failure.  
- **Scalable Design** – Horizontal scaling support for handling large numbers of concurrent users. 
 
## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 (TypeScript), Vite, Tailwind CSS 4, Socket.IO Client, Axios, Vercel
- **Backend**: Node.js (TypeScript), Express, Socket.IO, JWT, Pino, OCI VMs (Ubuntu 24.04)
- **Data & Messaging**: Redis (Cloud) for Pub/Sub & cache; PostgreSQL (Supabase) for persistence
- **Load Balancer**: Nginx (dev), OCI Load Balancer (prod)
- **Containerization**: Docker
- **Security**: Let’s Encrypt (TLS)

### System Components
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client 1  │    │   Client 2  │    │   Client N  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────┴──────┐
                   │     Load    │
                   │   Balancer  │
                   └──────┬──────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │  Backend 1  │   │  Backend 2  │   │  Backend 3  │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
            ┌─────────────┐     ┌─────────────┐
            │    Redis    │     │ PostgreSQL  │
            │  Pub/Sub +  │     │ Long-term   │
            │ cache/state │     │ persistence │
            └─────────────┘     └─────────────┘

```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ariellinfy/Liteline-2.0.git
   cd Liteline-2.0
   ```

2. **Set up environment variables**
   #### Backend
   ```env
   POSTGRES_URL=your_postgres_db_url
   REDIS_URL=chroma

   JWT_SECRET=gpt-4.1-nano-2025-04-14
   JWT_EXPIRES_IN=text-embedding-3-small

   ALLOWED_ORIGINS=http://localhost:5173
   PORT=8001
   NODE_ENV=development
   LOG_LEVEL=debug
   ```
   
   #### Frontend  
   ```env
   VITE_API_URL=http://localhost:8001
   ```

3. **Start development environment (Using Docker Compose)**
   ```bash
   docker compose up --build -d
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8001
   - Backend Health: http://localhost:8001/health

## 📁 Project Structure
```
liteline-2.0/
├── backend/                    # Node.js backend
│   ├── src/
│   │   ├── handlers/           # Socket.io event handlers
│   │   ├── middleware/         # Auth middleware
│   │   ├── services/           # Business logic services
│   │   ├── routes/             # API route definitions
│   │   ├── utils/              # Utility functions and helpers
│   │   ├── server.ts           # Express server setup
│   │   ├── app.ts              # Application entry point and setup
│   │   └── schema.sql          # SQL schema for database 
│   ├── Dockerfile              # Dockerfile for building the backend image
│   ├── package.json
│   └── .env                    # Environment variables for backend
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/           # context providers for state management
│   │   ├── services/           # API services
│   │   └── App.tsx             # Main React application component
│   ├── Dockerfile              # Dockerfile for building the frontend image
│   ├── package.json
│   └── .env                    # Environment variables for frontend
├── nginx/                      # Load balancer config (dev only)
│   └── nginx.conf
├── docker-compose.yml          # Development compose
├── LICENSE                     # Project license (MIT License)
└── README.md
```

## 🔌 API Endpoints

### REST API
- `GET /health` - Health check endpoint
- `POST /auth/register` - Health check endpoint
- `POST /auth/login` - Health check endpoint
- `GET /rooms/public` - Health check endpoint
- `GET /rooms/my-rooms` - Health check endpoint
- `POST /rooms/create` - Health check endpoint
- `POST /rooms/join` - Health check endpoint
- `POST /rooms/${roomId}/leave` - Health check endpoint

### Socket.io Events

#### Client → Server
- `join_room`: Join a chat room
- `leave_room`: Leave current room
- `send_message`: Send a message
- `load_more_messages`: Load more previous messages
- `typing_start`: Start typing indicator
- `typing_stop`: Stop typing indicator
- `get_room_presences`: Get presences of a room

#### Server → Client
- `room_update`: Room state changes
- `room_presences`: Up-to-date room presences
- `recent_messages`: Historical messages
- `more_messages_loaded`: Complete loading of requested messages
- `room_joined`: Successful room join
- `room_left`: Left room confirmation
- `user_typing`: Typing indicators
- `heartbeat_ack`: Acknowledge heartbeat from client
- `error`: Error messages

## 🌐 Distribution System Checklist
### Scalability
- [x] 2 backend instances behind provider load balancer
- [x] Redis Pub/Sub for cross-node message fan-out
- [ ] Autoscaling

### Real-Time Communication
- [x] WebSocket/Socket.IO transport
- [x] Multi-room chat (create/join/leave; public/private)
- [x] Presence updates broadcast to joined rooms
- [x] Typing indicators
- [ ] Offline queueing / store-and-forward
- [ ] End-to-end encryption

### Reliability & Availability
- [x] Multi-instance deployment behind LB
- [x] TLS termination (Let’s Encrypt)
- [x] Health endpoint (`/health`) for LB checks

### Persistence & Data Durability
- [x] Long-term persistence in PostgreSQL (Supabase)
- [x] Short-term/cache/state in Redis (Redis Cloud)

### Data Consistency & Synchronization
- [x] Presence/state synchronized across nodes via Pub/Sub
- [ ] Use client-generated UUIDs for messages to avoid duplicates on retry
- [ ] Per-room message ordering guarantees defined: **server timestamp order**
- [ ] Consistency model documented (e.g., eventual vs. strong)

## 📈 Future Enhancements

### Planned Features
- [ ] File sharing (images, documents, attachments)
- [ ] Mobile-responsive UI improvements
- [ ] Cross-platform clients (web, desktop, mobile)
- [ ] Offline messaging (store-and-forward delivery)
- [ ] End-to-end encryption (DMs & private rooms)
- [ ] Message search
- [ ] Push notifications (web/mobile)
- [ ] Admin/moderation dashboard

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis is running
   docker ps | grep redis
   
   # Restart Redis
   docker-compose restart redis
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port
   netstat -ano | findstr :8001
   
   # Kill process (Windows)
   taskkill /PID <PID> /F
   ```

3. **Docker Build Issues**
   ```bash
   # Clean Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

### Debug Mode
Set `NODE_ENV=development` and `LOG_LEVEL=debug` in backend `.env` for detailed logging.

## 📄 License
MIT License - see [LICENSE](LICENSE) file for details.
