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
  | { type: "SET_LOADING"; payload: boolean };

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

      return {
        ...state,
        messagesByRoom: {
          ...state.messagesByRoom,
          [prependRoomId]: {
            ...existingData,
            messages: [...messages, ...existingData.messages],
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

  // Initialize auth state on mount
  useEffect(() => {
    const storedAuth = authService.getStoredAuth();
    if (storedAuth) {
      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user: storedAuth, isAuthenticated: true },
      });
    }
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!state.isAuthenticated) return;

    socketService.onRoomUpdate((data) => {
      console.log("M5 9 C16 chatProvider.onRoomUpdate", data);
      if (data.type === "new_message") {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
      } else if (
        data.type === "user_joined" ||
        data.type === "user_left" ||
        data.type === "user_connected" ||
        data.type === "user_disconnected"
      ) {
        if (data.presences && data.roomId) {
          // console.log("room update", data);
          dispatch({
            type: "SET_ROOM_PRESENCES",
            payload: { roomId: data.roomId, presences: data.presences },
          });
        }
      }
    });

    socketService.onRoomJoined((data) => {
      console.log("J16 C24 chatProvider.onRoomJoined", data);

      dispatch({
        type: "SET_ROOM_PRESENCES",
        payload: { roomId: data.roomId, presences: data.presences },
      });
    });

    socketService.onRoomLeft((data) => {
      console.log("L9 chatProvider.onRoomLeft", data);
      dispatch({ type: "CLEAR_ROOM_DATA", payload: data.roomId });
      dispatch({ type: "REMOVE_USER_ROOM", payload: data.roomId });
      dispatch({ type: "SET_CURRENT_ROOM", payload: null });
    });

    socketService.onRoomPresences((data) => {
      console.log("chatProvider.onRoomPresences", data);
      dispatch({
        type: "SET_ROOM_PRESENCES",
        payload: { roomId: data.roomId, presences: data.presences },
      });
    });

    socketService.onMyRooms((data) => {
      console.log("chatProvider.onMyRooms", data);
      dispatch({ type: "SET_USER_ROOMS", payload: data.rooms });
    });

    socketService.onRecentMessages((data) => {
      console.log("J18 chatProvider.onRecentMessages", data);
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
      console.log("chatProvider.onMoreMessagesLoaded", data);
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
      console.log("chatProvider.onUserTyping", data);
      if (data.userId !== state.currentUser?.id) {
        dispatch({ type: "UPDATE_TYPING", payload: data });
      }
    });

    socketService.onError((error) => {
      console.log("chatProvider.onError", error);
      dispatch({ type: "SET_ERROR", payload: error });
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [state.isAuthenticated, state.currentUser?.id]);

  // Auth methods
  const login = async (email: string, password: string): Promise<void> => {
    console.log("chatProvider.login");
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const user = await authService.login({ email, password });
      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user, isAuthenticated: true },
      });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
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
    console.log("chatProvider.register");
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const user = await authService.register({ username, email, password });
      dispatch({
        type: "SET_AUTHENTICATED",
        payload: { user, isAuthenticated: true },
      });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = (): void => {
    console.log("chatProvider.logout");
    authService.logout();
    socketService.disconnect();
    dispatch({
      type: "SET_AUTHENTICATED",
      payload: { user: null, isAuthenticated: false },
    });
    dispatch({ type: "SET_CONNECTED", payload: false });
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
    dispatch({ type: "SET_USER_ROOMS", payload: [] });
    dispatch({ type: "SET_PUBLIC_ROOMS", payload: [] });
  };

  // Connection methods
  const connect = async (): Promise<void> => {
    console.log("chatProvider.connect");
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
        payload: {
          message: "Failed to connect to server",
          code: "SERVER_ERROR",
        },
      });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const disconnect = (): void => {
    console.log("chatProvider.disconnect");
    socketService.disconnect();
    dispatch({ type: "SET_CONNECTED", payload: false });
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
  };

  // Room methods
  const loadUserRooms = async (): Promise<void> => {
    try {
      const rooms = await roomService.getUserRooms();
      console.log("chatProvider.loadUserRooms");
      dispatch({ type: "SET_USER_ROOMS", payload: rooms });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: { message: "Failed to load user rooms", code: "SERVER_ERROR" },
      });
    }
  };

  const loadPublicRooms = async (): Promise<void> => {
    try {
      const rooms = await roomService.getPublicRooms();
      console.log("chatProvider.loadPublicRooms");
      dispatch({ type: "SET_PUBLIC_ROOMS", payload: rooms });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          message: "Failed to load public rooms",
          code: "SERVER_ERROR",
        },
      });
    }
  };

  const createRoom = async (
    name: string,
    description: string,
    isPrivate: boolean,
    passcode?: string
  ): Promise<void> => {
    console.log("C1 chatProvider.createRoom");
    try {
      const room = await roomService.createRoom({
        name,
        description,
        isPrivate,
        passcode,
      });
      await socketService.joinRoom(room.id, false);
      console.log(room);
      dispatch({ type: "ADD_USER_ROOM", payload: room });
      dispatch({ type: "SET_CURRENT_ROOM", payload: room.id });
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
      throw error;
    }
  };

  const joinRoom = async (roomId: string, passcode?: string): Promise<void> => {
    console.log("J1 chatProvider.joinRoom");
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
      console.log(error.message);
      dispatch({ type: "SET_ERROR", payload: error });
      throw error;
    }
  };

  const leaveRoom = async (roomId: string): Promise<void> => {
    console.log("L1 chatProvider.leaveRoom", state.currentRoomId);
    try {
      await roomService.leaveRoom(roomId);
      console.log("after room service", state.currentRoomId);
      await socketService.leaveRoom(roomId);
      dispatch({ type: "SET_ERROR", payload: null });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
      throw error;
    }
  };

  const switchToRoom = async (
    roomId: string,
    passcode?: string
  ): Promise<void> => {
    console.log("chatProvider.switchToRoom", roomId);
    await joinRoom(roomId, passcode);
  };

  const goToLobby = (): void => {
    console.log("chatProvider.goToLobby");
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
  };

  // Message methods
  const sendMessage = async (content: string): Promise<void> => {
    console.log("M1 chatProvider.sendMessage");
    if (content.trim() && state.currentRoomId) {
      await socketService.sendMessage(state.currentRoomId, content);
    }
  };

  const loadMoreMessages = async (roomId: string): Promise<void> => {
    console.log("LM1 chatProvider.loadMoreMessages");
    const roomData = state.messagesByRoom[roomId];
    console.log(state);
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
        payload: {
          message: "Failed to load more messages",
          code: "SERVER_ERROR",
        },
      });
      dispatch({
        type: "SET_MESSAGES_LOADING",
        payload: { roomId, loading: false },
      });
    }
  };

  // Typing methods
  const startTyping = (roomId: string): void => {
    console.log("socketService.startTyping");
    socketService.startTyping(roomId);
  };

  const stopTyping = (roomId: string): void => {
    console.log("socketService.stopTyping");
    socketService.stopTyping(roomId);
  };

  // Utility methods
  const getRoomData = (roomId: string) => {
    // console.log("chatProvider.getRoomData");
    return (
      state.messagesByRoom[roomId] || {
        messages: [],
        hasMore: false,
        isLoading: false,
      }
    );
  };

  const getRoomPresences = (roomId: string): UserPresence[] => {
    // console.log("chatProvider.getRoomPresences", state.presencesByRoom[roomId]);
    return state.presencesByRoom[roomId] || [];
  };

  const getRoomTyping = (roomId: string): TypingUser[] => {
    // console.log("chatProvider.getRoomTyping");
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
