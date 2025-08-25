import React, { useState, useEffect } from "react";
import { useChat } from "../../contexts/ChatContext";
import LoadingSpinner from "../utility/LoadingSpinner";
import ErrorAlert from "../utility/ErrorAlert";
import AuthContainer from "../auth/AuthContainer";
import ChatLobby from "../chat/ChatLobby";
import ChatRoom from "../chat/ChatRoom";

const ChatContainer: React.FC = () => {
  const { state, connect, disconnect } = useChat();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeConnection = async () => {
      if (!state.isAuthenticated) {
        setIsInitialized(true);
        return;
      }

      try {
        await connect();
      } catch (error) {
        console.error("Failed to initialize connection:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeConnection();

    return () => {
      if (state.isConnected) {
        disconnect();
      }
    };
  }, [state.isAuthenticated]);

  // Show loading while initializing
  if (!isInitialized || state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {!state.isAuthenticated
              ? "Loading..."
              : "Connecting to chat server..."}
          </p>
        </div>
      </div>
    );
  }

  // Show auth form if not authenticated
  if (!state.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {state.error && <ErrorAlert message={state.error.message} />}
        <div className="flex items-center justify-center min-h-screen px-4">
          <AuthContainer />
        </div>
      </div>
    );
  }

  // Show connection error if authenticated but not connected
  if (state.isAuthenticated && !state.isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
              Connection Failed
            </h2>
            <p className="text-red-700 dark:text-red-300">
              Unable to connect to the chat server. Please check if the server
              is running.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show main chat interface
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {state.error && <ErrorAlert message={state.error.message} />}

      {!state.currentRoomId ? <ChatLobby /> : <ChatRoom />}
    </div>
  );
};

export default ChatContainer;
