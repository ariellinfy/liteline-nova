import React, { createContext, useContext, useReducer, useEffect } from "react";
import {
  Message,
  TypingUser,
  UserPresence,
  AuthUser,
  Room,
  MessagePaginationRequest,
  ApiError,
} from "../types";
import { socketService } from "../services/socket";
import { authService } from "../services/auth";
import { roomService } from "../services/room";
import { makeLogger } from "../utils/log";

interface ChatState {
  // Auth
  currentUser: AuthUser | null;
  isAuthenticated: boolean;

  // Connection
  isConnected: boolean;

  // Rooms
  currentRoomId: string | null;
  userRooms: Room[];
  publicRooms: Room[];

  // Messages per room
  messagesByRoom: Record<
    string,
    {
      messages: Message[];
      hasMore: boolean;
      nextCursor?: string;
      isLoading: boolean;
    }
  >;

  // Presence per room
  presencesByRoom: Record<string, UserPresence[]>;

  // Typing per room
  typingByRoom: Record<string, TypingUser[]>;

  // UI state
  error: ApiError | null;
  isLoading: boolean;
}

type ChatAction =
  | {
      type: "SET_AUTHENTICATED";
      payload: { user: AuthUser | null; isAuthenticated: boolean };
    }
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_CURRENT_ROOM"; payload: string | null }
  | { type: "SET_USER_ROOMS"; payload: Room[] }
  | { type: "ADD_USER_ROOM"; payload: Room }
  | { type: "REMOVE_USER_ROOM"; payload: string }
  | { type: "SET_PUBLIC_ROOMS"; payload: Room[] }
  | {
      type: "SET_ROOM_MESSAGES";
      payload: {
        roomId: string;
        messages: Message[];
        hasMore?: boolean;
        nextCursor?: string;
      };
    }
  | { type: "ADD_MESSAGE"; payload: Message }
  | {
      type: "PREPEND_MESSAGES";
      payload: {
        roomId: string;
        messages: Message[];
        hasMore: boolean;
        nextCursor?: string;
      };
    }
  | {
      type: "SET_MESSAGE_PAGINATION";
      payload: { roomId: string; hasMore: boolean; nextCursor?: string };
    }
  | { type: "CLEAR_ROOM_DATA"; payload: string }
  | {
      type: "SET_MESSAGES_LOADING";
      payload: { roomId: string; loading: boolean };
    }
  | {
      type: "SET_ROOM_PRESENCES";
      payload: { roomId: string; presences: UserPresence[] };
    }
  | { type: "UPDATE_TYPING"; payload: TypingUser }
  | { type: "CLEAR_ROOM_TYPING"; payload: string }
  | { type: "SET_ERROR"; payload: ApiError | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESET_STATE" };

const initialState: ChatState = {
  currentUser: null,
  isAuthenticated: false,
  isConnected: false,
  currentRoomId: null,
  userRooms: [],
  publicRooms: [],
  messagesByRoom: {},
  presencesByRoom: {},
  typingByRoom: {},
  error: null,
  isLoading: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_AUTHENTICATED":
      return {
        ...state,
        currentUser: action.payload.user,
        isAuthenticated: action.payload.isAuthenticated,
      };

    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };

    case "SET_CURRENT_ROOM":
      return { ...state, currentRoomId: action.payload };

    case "SET_USER_ROOMS":
      return { ...state, userRooms: action.payload };

    case "ADD_USER_ROOM":
      return {
        ...state,
        userRooms: [
          ...state.userRooms.filter((r) => r.id !== action.payload.id),
          action.payload,
        ],
      };

    case "REMOVE_USER_ROOM":
      return {
        ...state,
        userRooms: state.userRooms.filter((r) => r.id !== action.payload),
      };

    case "SET_PUBLIC_ROOMS":
      return { ...state, publicRooms: action.payload };

    case "SET_ROOM_MESSAGES":
      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [action.payload.roomId]: {
            messages: action.payload.messages,
            hasMore: !!action.payload.hasMore,
            nextCursor: action.payload.nextCursor,
            isLoading: false,
          },
        },
      };

    case "ADD_MESSAGE":
      const roomId = action.payload.roomId;
      const currentRoomData = state.messagesByRoom[roomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      };

      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: {
            ...currentRoomData,
            messages: [...currentRoomData.messages, action.payload],
          },
        },
      };

    case "PREPEND_MESSAGES":
      const {
        roomId: prependRoomId,
        messages,
        hasMore,
        nextCursor,
      } = action.payload;
      const existingData = state.messagesByRoom[prependRoomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      };
      const existingIds = new Set(existingData.messages.map((m) => m.id));
      const uniqueNew = messages.filter((m) => !existingIds.has(m.id));

      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [prependRoomId]: {
            ...existingData,
            messages: [...uniqueNew, ...existingData.messages],
            hasMore,
            nextCursor,
            isLoading: false,
          },
        },
      };

    case "SET_MESSAGE_PAGINATION":
      const paginationRoomId = action.payload.roomId;
      const paginationData = state.messagesByRoom[paginationRoomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      };

      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [paginationRoomId]: {
            ...paginationData,
            hasMore: action.payload.hasMore,
            nextCursor: action.payload.nextCursor,
          },
        },
      };

    case "SET_MESSAGES_LOADING":
      const loadingRoomId = action.payload.roomId;
      const loadingData = state.messagesByRoom[loadingRoomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      };

      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [loadingRoomId]: {
            ...loadingData,
            isLoading: action.payload.loading,
          },
        },
      };

    case "SET_ROOM_PRESENCES":
      return {
        ...state,
        presencesByRoom: {
          ...state.presencesByRoom,
          [action.payload.roomId]: action.payload.presences,
        },
      };

    case "UPDATE_TYPING":
      const typingRoomId = action.payload.roomId;
      const currentTyping = state.typingByRoom[typingRoomId] || [];
      const { userId, isTyping } = action.payload;

      let newTyping;
      if (isTyping) {
        newTyping = currentTyping.find((t) => t.userId === userId)
          ? currentTyping.map((t) => (t.userId === userId ? action.payload : t))
          : [...currentTyping, action.payload];
      } else {
        newTyping = currentTyping.filter((t) => t.userId !== userId);
      }

      return {
        ...state,
        typingByRoom: {
          ...state.typingByRoom,
          [typingRoomId]: newTyping,
        },
      };

    case "CLEAR_ROOM_TYPING":
      return {
        ...state,
        typingByRoom: {
          ...state.typingByRoom,
          [action.payload]: [],
        },
      };

    case "CLEAR_ROOM_DATA":
      const clearRoomId = action.payload;
      const newMessagesByRoom = { ...state.messagesByRoom };
      const newPresencesByRoom = { ...state.presencesByRoom };
      const newTypingByRoom = { ...state.typingByRoom };

      delete newMessagesByRoom[clearRoomId];
      delete newPresencesByRoom[clearRoomId];
      delete newTypingByRoom[clearRoomId];

      return {
        ...state,
        messagesByRoom: newMessagesByRoom,
        presencesByRoom: newPresencesByRoom,
        typingByRoom: newTypingByRoom,
      };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "RESET_STATE":
      return { ...initialState };

    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => void;
  // Room methods
  loadUserRooms: () => Promise<void>;
  loadPublicRooms: () => Promise<void>;
  createRoom: (
    name: string,
    description: string,
    isPrivate: boolean,
    passcode?: string
  ) => Promise<void>;
  joinRoom: (roomId: string, passcode?: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  switchToRoom: (roomId: string) => void;
  goToLobby: () => void;
  // Message methods
  sendMessage: (content: string) => void;
  loadMoreMessages: (roomId: string) => Promise<void>;
  // Typing methods
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  // Utility methods
  getRoomData: (roomId: string) => {
    messages: Message[];
    hasMore: boolean;
    isLoading: boolean;
  };
  getRoomPresences: (roomId: string) => UserPresence[];
  getRoomTyping: (roomId: string) => TypingUser[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { log, error } = makeLogger("ChatContext");

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      const storedAuth = await authService.getStoredAuth();
      if (storedAuth) {
        dispatch({
          type: "SET_AUTHENTICATED",
          payload: { user: storedAuth, isAuthenticated: true },
        });
      }
      dispatch({ type: "SET_LOADING", payload: false });
    };

    initializeAuth();
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!state.isAuthenticated) {
      socketService.disconnect(); // Ensure socket is disconnected if not authenticated
      return;
    }

    socketService.onRoomUpdate((data) => {
      log("onRoomUpdate", data);

      if (data.type === "new_message") {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
      } else if (
        data.type === "user_joined" ||
        data.type === "user_left" ||
        data.type === "user_connected" ||
        data.type === "user_disconnected"
      ) {
        if (data.presences && data.roomId) {
          dispatch({
            type: "SET_ROOM_PRESENCES",
            payload: { roomId: data.roomId, presences: data.presences },
          });
        }
      }
    });

    socketService.onRoomJoined((data) => {
      log("onRoomJoined", data);
      dispatch({
        type: "SET_ROOM_PRESENCES",
        payload: { roomId: data.roomId, presences: data.presences },
      });
    });

    socketService.onRoomLeft((data) => {
      log("onRoomLeft", data);
      dispatch({ type: "CLEAR_ROOM_DATA", payload: data.roomId });
      dispatch({ type: "REMOVE_USER_ROOM", payload: data.roomId });
      dispatch({ type: "SET_CURRENT_ROOM", payload: null });
    });

    socketService.onRoomPresences((data) => {
      log("onRoomPresences", data);
      dispatch({
        type: "SET_ROOM_PRESENCES",
        payload: { roomId: data.roomId, presences: data.presences },
      });
    });

    socketService.onMyRooms((data) => {
      log("onMyRooms", data);
      dispatch({ type: "SET_USER_ROOMS", payload: data.rooms });
    });

    socketService.onRecentMessages((data) => {
      log("onRecentMessages", data);
      dispatch({
        type: "SET_ROOM_MESSAGES",
        // payload: { roomId: data.roomId, messages: data.messages },
        payload: {
          roomId: data.roomId,
          messages: data.messages,
          hasMore: data.hasMore,
          nextCursor: data.nextCursor,
        },
      });
    });

    socketService.onMoreMessagesLoaded((data) => {
      log("onMoreMessagesLoaded", data);
      dispatch({
        type: "PREPEND_MESSAGES",
        payload: {
          roomId: data.roomId,
          messages: data.messages,
          hasMore: data.hasMore,
          nextCursor: data.nextCursor,
        },
      });
    });

    socketService.onUserTyping((data) => {
      log("onUserTyping", data);
      if (data.userId !== state.currentUser?.id) {
        dispatch({ type: "UPDATE_TYPING", payload: data });
      }
    });

    socketService.onError((error: any) => {
      log("onError", error);
      const wrapped =
        error instanceof ApiError
          ? error
          : new ApiError(error?.message || "Socket error", "GENERIC");
      dispatch({ type: "SET_ERROR", payload: wrapped });
      // If error is due to authentication, log out
      if (wrapped.code === "UNAUTHORIZED") {
        logout();
      }
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [state.isAuthenticated, state.currentUser?.id]);

  // Auth methods
  const login = async (email: string, password: string): Promise<void> => {
    log("login");
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const user = await authService.login({ email, password });
      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user, isAuthenticated: true },
      });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error as ApiError });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string
  ): Promise<void> => {
    log("register");
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const user = await authService.register({ username, email, password });
      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user, isAuthenticated: true },
      });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error as ApiError });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = (): void => {
    log("logout");
    authService.logout();
    socketService.disconnect();
    dispatch({ type: "RESET_STATE" });
  };

  // Connection methods
  const connect = async (): Promise<void> => {
    log("connect");
    if (!state.isAuthenticated) {
      throw new Error("Not authenticated");
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      await socketService.connect();
      dispatch({ type: "SET_CONNECTED", payload: true });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: new ApiError("Failed to connect to server", "SERVER_ERROR"),
      });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const disconnect = (): void => {
    log("disconnect");
    socketService.disconnect();
    dispatch({ type: "SET_CONNECTED", payload: false });
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
  };

  // Room methods
  const loadUserRooms = async (): Promise<void> => {
    log("loadUserRooms");
    try {
      const rooms = await roomService.getUserRooms();
      dispatch({ type: "SET_USER_ROOMS", payload: rooms });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: new ApiError("Failed to load user rooms", "SERVER_ERROR"),
      });
    }
  };

  const loadPublicRooms = async (): Promise<void> => {
    log("loadPublicRooms");
    try {
      const rooms = await roomService.getPublicRooms();
      dispatch({ type: "SET_PUBLIC_ROOMS", payload: rooms });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: new ApiError("Failed to load public rooms", "SERVER_ERROR"),
      });
    }
  };

  const createRoom = async (
    name: string,
    description: string,
    isPrivate: boolean,
    passcode?: string
  ): Promise<void> => {
    log("createRoom");
    try {
      const room = await roomService.createRoom({
        name,
        description,
        isPrivate,
        passcode,
      });
      await socketService.joinRoom(room.id, false);
      dispatch({ type: "ADD_USER_ROOM", payload: room });
      dispatch({ type: "SET_CURRENT_ROOM", payload: room.id });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error as ApiError });
      throw error;
    }
  };

  const joinRoom = async (roomId: string, passcode?: string): Promise<void> => {
    log("joinRoom");
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const { room, alreadyJoined } = await roomService.joinRoom({
        roomId,
        passcode,
      });
      await socketService.joinRoom(room.id, alreadyJoined);
      dispatch({ type: "ADD_USER_ROOM", payload: room });
      dispatch({ type: "SET_CURRENT_ROOM", payload: room.id });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error as ApiError });
      throw error;
    }
  };

  const leaveRoom = async (roomId: string): Promise<void> => {
    log("leaveRoom");
    try {
      await roomService.leaveRoom(roomId);
      await socketService.leaveRoom(roomId);
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error as ApiError });
      throw error;
    }
  };

  const switchToRoom = async (
    roomId: string,
    passcode?: string
  ): Promise<void> => {
    log("switchToRoom", roomId);
    await joinRoom(roomId, passcode);
  };

  const goToLobby = (): void => {
    log("goToLobby");
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
  };

  // Message methods
  const sendMessage = async (content: string): Promise<void> => {
    log("sendMessage");
    if (content.trim() && state.currentRoomId) {
      await socketService.sendMessage(state.currentRoomId, content);
    }
  };

  const loadMoreMessages = async (roomId: string): Promise<void> => {
    log("loadMoreMessages");
    const roomData = state.messagesByRoom[roomId];

    if (!roomData || roomData.isLoading || !roomData.hasMore) {
      return;
    }

    dispatch({
      type: "SET_MESSAGES_LOADING",
      payload: { roomId, loading: true },
    });

    try {
      const request: MessagePaginationRequest = {
        roomId,
        limit: 50,
        before: roomData.nextCursor, // should be the ID of the oldest message
      };
      await socketService.loadMoreMessages(request);
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: new ApiError("Failed to load more messages", "SERVER_ERROR"),
      });
    } finally {
      dispatch({
        type: "SET_MESSAGES_LOADING",
        payload: { roomId, loading: false },
      });
    }
  };

  // Typing methods
  const startTyping = (roomId: string): void => {
    log("startTyping");
    socketService.startTyping(roomId);
  };

  const stopTyping = (roomId: string): void => {
    log("stopTyping");
    socketService.stopTyping(roomId);
  };

  // Utility methods
  const getRoomData = (roomId: string) => {
    // log("getRoomData");
    return (
      state.messagesByRoom[roomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      }
    );
  };

  const getRoomPresences = (roomId: string): UserPresence[] => {
    // log("getRoomPresences");
    return state.presencesByRoom[roomId] || [];
  };

  const getRoomTyping = (roomId: string): TypingUser[] => {
    // log("getRoomTyping");
    return state.typingByRoom[roomId] || [];
  };

  const value: ChatContextType = {
    state,
    login,
    register,
    logout,
    connect,
    disconnect,
    loadUserRooms,
    loadPublicRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    switchToRoom,
    goToLobby,
    sendMessage,
    loadMoreMessages,
    startTyping,
    stopTyping,
    getRoomData,
    getRoomPresences,
    getRoomTyping,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
