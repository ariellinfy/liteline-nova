import React, { createContext, useContext, useReducer, useEffect } from "react";
import {
  socketService,
  Message,
  TypingUser,
  UserPresence,
} from "../services/socket";

interface ChatState {
  isConnected: boolean;
  currentRoom: string | null;
  currentUser: { id: string; username: string } | null;
  messages: Message[];
  roomPresences: UserPresence[];
  typingUsers: TypingUser[];
  error: string | null;
  isLoading: boolean;
}

type ChatAction =
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_CURRENT_ROOM"; payload: string | null }
  | {
      type: "SET_CURRENT_USER";
      payload: { id: string; username: string } | null;
    }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "SET_ROOM_PRESENCES"; payload: UserPresence[] }
  | { type: "UPDATE_PRESENCE"; payload: UserPresence }
  | { type: "UPDATE_TYPING_USERS"; payload: TypingUser }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_TYPING_USERS" };

const initialState: ChatState = {
  isConnected: false,
  currentRoom: null,
  currentUser: null,
  messages: [],
  roomPresences: [],
  typingUsers: [],
  error: null,
  isLoading: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };
    case "SET_CURRENT_ROOM":
      return { ...state, currentRoom: action.payload };
    case "SET_CURRENT_USER":
      return { ...state, currentUser: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_ROOM_PRESENCES":
      return { ...state, roomPresences: action.payload };
    case "UPDATE_PRESENCE":
      const updatedPresences = state.roomPresences.map((presence) =>
        presence.userId === action.payload.userId ? action.payload : presence
      );

      // If presence doesn't exist, add it
      if (
        !state.roomPresences.find((p) => p.userId === action.payload.userId)
      ) {
        updatedPresences.push(action.payload);
      }

      return { ...state, roomPresences: updatedPresences };
    case "UPDATE_TYPING_USERS":
      const { userId, isTyping } = action.payload;
      const existingIndex = state.typingUsers.findIndex(
        (user) => user.userId === userId
      );

      if (isTyping) {
        if (existingIndex === -1) {
          return {
            ...state,
            typingUsers: [...state.typingUsers, action.payload],
          };
        } else {
          return {
            ...state,
            typingUsers: state.typingUsers.map((user) =>
              user.userId === userId ? action.payload : user
            ),
          };
        }
      } else {
        return {
          ...state,
          typingUsers: state.typingUsers.filter(
            (user) => user.userId !== userId
          ),
        };
      }
    case "CLEAR_TYPING_USERS":
      return { ...state, typingUsers: [] };
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
  connect: () => Promise<void>;
  disconnect: () => void;
  joinRoom: (roomId: string, userId: string, username: string) => void;
  leaveRoom: () => void;
  sendMessage: (content: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  updatePresence: (status: "online" | "offline") => void;
  refreshPresences: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    // Set up socket event listeners
    socketService.onRoomUpdate((data) => {
      console.log("onRoomUpdate: joinRoom", data);
      if (data.type === "new_message") {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
      } else if (data.type === "user_joined" || data.type === "user_left") {
        if (data.presences) {
          dispatch({ type: "SET_ROOM_PRESENCES", payload: data.presences });
        }
      }
    });

    socketService.onRecentMessages((messages) => {
      console.log("onRecentMessages: joinRoom", messages);
      dispatch({ type: "SET_MESSAGES", payload: messages });
    });

    socketService.onRoomJoined((data) => {
      console.log("onRoomJoined: joinRoom", data);
      dispatch({ type: "SET_CURRENT_ROOM", payload: data.roomId });
      dispatch({ type: "SET_ROOM_PRESENCES", payload: data.presences });
    });

    socketService.onRoomLeft(() => {
      dispatch({ type: "SET_CURRENT_ROOM", payload: null });
      dispatch({ type: "SET_MESSAGES", payload: [] });
      dispatch({ type: "SET_ROOM_PRESENCES", payload: [] });
      dispatch({ type: "CLEAR_TYPING_USERS" });
    });

    socketService.onUserTyping((data) => {
      console.log("onUserTyping: stopTyping", data)
      // Don't show typing indicator for current user
      if (data.userId !== state.currentUser?.id) {
        dispatch({ type: "UPDATE_TYPING_USERS", payload: data });
      }
    });

    socketService.onPresenceUpdate((data) => {
      console.log("onPresenceUpdate: joinRoom", data);
      if (data.type === "user_online" || data.type === "user_offline") {
        const presence: UserPresence = {
          userId: data.userId,
          username: data.username,
          status: data.type === "user_online" ? "online" : "offline",
          lastSeen: new Date().toISOString(),
          roomId: data.roomId,
        };
        dispatch({ type: "UPDATE_PRESENCE", payload: presence });
      }
    });

    socketService.onPresenceUpdated((data) => {
      dispatch({ type: "SET_ROOM_PRESENCES", payload: data.presences });
    });

    socketService.onRoomPresences((data) => {
      dispatch({ type: "SET_ROOM_PRESENCES", payload: data.presences });
    });

    socketService.onError((error) => {
      dispatch({ type: "SET_ERROR", payload: error.message });
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const connect = async (): Promise<void> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      await socketService.connect();
      dispatch({ type: "SET_CONNECTED", payload: true });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to connect to server" });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const disconnect = (): void => {
    socketService.disconnect();
    dispatch({ type: "SET_CONNECTED", payload: false });
    dispatch({ type: "SET_CURRENT_ROOM", payload: null });
    dispatch({ type: "SET_CURRENT_USER", payload: null });
    dispatch({ type: "SET_MESSAGES", payload: [] });
    dispatch({ type: "SET_ROOM_PRESENCES", payload: [] });
    dispatch({ type: "CLEAR_TYPING_USERS" });
  };

  const joinRoom = (roomId: string, userId: string, username: string): void => {
    dispatch({ type: "SET_CURRENT_USER", payload: { id: userId, username } });
    dispatch({ type: "SET_ERROR", payload: null });
    socketService.joinRoom(roomId, userId, username);
  };

  const leaveRoom = (): void => {
    socketService.leaveRoom();
  };

  const sendMessage = (content: string): void => {
    if (content.trim()) {
      socketService.sendMessage(content);
    }
  };

  const startTyping = (): void => {
    socketService.startTyping();
  };

  const stopTyping = (): void => {
    socketService.stopTyping();
  };

  const updatePresence = (status: "online" | "offline"): void => {
    socketService.updatePresence(status);
  };

  const refreshPresences = (): void => {
    socketService.getRoomPresences();
  };

  const value: ChatContextType = {
    state,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    updatePresence,
    refreshPresences,
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
