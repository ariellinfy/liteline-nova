export interface User {
  id: string;
  username: string;
  email: string;
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

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  type: "text" | "system";
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
  activeRooms: string[];
}

export interface TypingUser {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  token: string;
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

export interface CreateRoomRequest {
  name: string;
  description?: string;
  isPrivate: boolean;
  passcode?: string;
}

export interface JoinRoomRequest {
  roomId: string;
  passcode?: string;
}

export interface MessagePaginationRequest {
  roomId: string;
  limit?: number;
  before?: string;
}

export interface MessageResponse {
  roomId: string;
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface AuthFormProps {
  onSuccess?: () => void;
}

export type ApiErrorCode =
  | "PASSCODE_REQUIRED"
  | "INVALID_PASSCODE"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DUPLICATE_ROOM_NAME"
  | "SERVER_ERROR"
  | "GENERIC";

export interface ApiError {
  message: string;
  code?: ApiErrorCode;
}
