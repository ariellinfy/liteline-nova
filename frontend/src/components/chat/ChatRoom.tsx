import React, { useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import UserList from "../room/UserList";
import CreateRoomModal from "../room/CreateRoomModal";
import JoinRoomModal from "../room/JoinRoomModal";
import JoinedRoomList from "../room/JoinedRoomList";
import MessageList from "../message/MessageList";
import MessageInput from "../message/MessageInput";
import {
  IconCreate,
  IconJoin,
  IconLeave,
  IconLobby,
  IconLogout,
} from "../utility/Icons";

const ChatRoom: React.FC = () => {
  const { state, leaveRoom, logout, goToLobby } = useChat();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "rooms">("users");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  if (!state.currentRoomId) return null;

  const currentRoom = state.userRooms.find((r) => r.id === state.currentRoomId);

  const handleLeaveRoom = async () => {
    if (state.currentRoomId) {
      await leaveRoom(state.currentRoomId);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        ${showMobileSidebar ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 w-64 
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
        transition-transform duration-300 ease-in-out md:flex md:flex-shrink-0
      `}
      >
        <div className="flex flex-col w-full">
          <div className="px-4 pt-4 flex justify-between">
            <div className="flex items-center gap-2 text-sm pt-4">
              <button
                onClick={() => setActiveTab("users")}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  activeTab === "users"
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab("rooms")}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  activeTab === "rooms"
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Rooms
              </button>
            </div>
            <div className="flex items-center justify-end fixed left-55">
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "users" ? (
              <UserList roomId={state.currentRoomId} />
            ) : (
              <JoinedRoomList />
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Lobby */}
              <button
                onClick={goToLobby}
                className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg 
                           transition-colors flex items-center justify-center space-x-2"
                title="Back to lobby"
              >
                <IconLobby />
                <span>Lobby</span>
              </button>

              {/* Leave */}
              <button
                onClick={handleLeaveRoom}
                className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg 
                           transition-colors flex items-center justify-center space-x-2"
              >
                <IconLeave />
                <span>Leave</span>
              </button>

              {/* Create */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg 
                           transition-colors flex items-center justify-center space-x-2"
              >
                <IconCreate />
                <span>Create</span>
              </button>

              {/* Join */}
              <button
                onClick={() => setShowJoinModal(true)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                           transition-colors flex items-center justify-center space-x-2"
              >
                <IconJoin />
                <span>Join</span>
              </button>
            </div>
            {/* Logout */}
            <button
              onClick={logout}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg 
                         transition-colors flex items-center justify-center space-x-2"
            >
              <IconLogout />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                {/* Room info */}
                <div className="flex gap-3 items-center justify-start">
                  {currentRoom?.isPrivate && (
                    <div
                      className="flex items-center text-gray-500 dark:text-gray-400"
                      title="Private room"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white pb-0.5">
                    {currentRoom?.name || state.currentRoomId}
                  </h1>
                </div>

                {currentRoom?.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1.5">
                    {currentRoom.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentRoom?.memberCount} member
                  {currentRoom?.memberCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages & Input */}
        <div className="flex-1 flex flex-col min-h-0">
          <MessageList roomId={state.currentRoomId} />
          <MessageInput roomId={state.currentRoomId} />
        </div>
      </div>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
    </div>
  );
};

export default ChatRoom;
