import React, { useState, useEffect } from "react";
import { useChat } from "../../contexts/ChatContext";
import JoinForm from "./JoinForm";
import ChatRoom from "./ChatRoom";
import LoadingSpinner from "../utility/LoadingSpinner";
import ErrorAlert from "../utility/ErrorAlert";

const ChatContainer: React.FC = () => {
  const { state, connect, disconnect } = useChat();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await connect();
      } catch (error) {
        console.error("Failed to initialize connection:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeConnection();
    return () => disconnect();
  }, []);

  if (!isInitialized || state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Connecting to chat server...
          </p>
        </div>
      </div>
    );
  }

  if (!state.isConnected) {
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

  return (
    <div className="min-h-screen">
      {state.error && <ErrorAlert message={state.error} />}

      {!state.currentRoom ? (
        <div className="flex items-center justify-center min-h-screen px-4">
          <JoinForm />
        </div>
      ) : (
        <ChatRoom />
      )}
    </div>
  );
};

export default ChatContainer;
