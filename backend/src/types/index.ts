export interface User {
  id: string;
  username: string;
  email: string;
  socketId?: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  memberCount?: number;
}

export interface RoomMembership {
  userId: string;
  roomId: string;
  joinedAt: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  type: "text" | "system"; // messageType
  timestamp: string;
  isDeleted?: boolean;
  editedAt?: string;
  replyToId?: string;
}

export interface UserPresence {
  userId: string;
  username: string;
  status: "online" | "offline";
  lastSeen: string;
  activeRooms: string[]; // Multiple rooms
}

export interface AuthPayload {
  userId: string;
  username: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface JoinRoomRequest {
  roomId: string;
  passcode?: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  isPrivate: boolean;
  passcode?: string;
}

export interface MessagePaginationRequest {
  roomId: string;
  limit?: number;
  before?: string; // message ID for pagination
}

export interface MessageResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string; // check what this is doing
}

export type ErrorCode =
  | "PASSCODE_REQUIRED"
  | "INVALID_PASSCODE"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DUPLICATE_ROOM_NAME"
  | "GENERIC";

export interface Error {
  message: string;
  code?: ErrorCode;
}
