import React from "react";
import { useChat } from "../../contexts/ChatContext";
import ChatHeader from "../utility/ChatHeader";
import MessageList from "../message/MessageList";
import MessageInput from "../message/MessageInput";
import UserList from "../utility/UserList";

const ChatRoom: React.FC = () => {
  const { state } = useChat();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar with user list */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Room: {state.currentRoom}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              test
              {/* {state.roomUsers.length} user
              {state.roomUsers.length !== 1 ? "s" : ""} online */}
            </p>
          </div>
          <UserList />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />

        <div className="flex-1 flex flex-col min-h-0">
          <MessageList />
          <MessageInput />
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
