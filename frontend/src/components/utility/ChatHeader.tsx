import React from "react";
import { useChat } from "../../contexts/ChatContext";

const ChatHeader: React.FC = () => {
  const { state, leaveRoom } = useChat();

  const onlineCount = state.roomPresences.filter(
    (p) => p.status === "online"
  ).length;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {state.currentRoom}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {onlineCount} user{onlineCount !== 1 ? "s" : ""} online
          </p>
        </div>
        <button
          onClick={leaveRoom}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
