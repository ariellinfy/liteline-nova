import React, { useState, useEffect, useMemo } from "react";
import { useChat } from "../../contexts/ChatContext";

interface RoomListProps {
  onRoomSelect?: (roomId: string) => void;
}

const RoomList: React.FC<RoomListProps> = ({ onRoomSelect }) => {
  const { state, loadUserRooms, loadPublicRooms, switchToRoom } = useChat();
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  useEffect(() => {
    loadUserRooms();
    loadPublicRooms();
  }, []);

  const handleRoomClick = (roomId: string) => {
    switchToRoom(roomId);
    onRoomSelect?.(roomId);
  };

  const formatMemberCount = (count?: number) => {
    if (!count) return "0 members";
    return count === 1 ? "1 member" : `${count} members`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  // Hide empty rooms (memberCount <= 0 or falsy)
  const visibleUserRooms = useMemo(
    () => state.userRooms.filter((r: any) => (r.memberCount ?? 0) > 0),
    [state.userRooms]
  );
  const visiblePublicRooms = useMemo(
    () => state.publicRooms.filter((r: any) => (r.memberCount ?? 0) > 0),
    [state.publicRooms]
  );

  const roomsToShow =
    activeTab === "my" ? visibleUserRooms : visiblePublicRooms;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("my")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "my"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            My Rooms ({visibleUserRooms.length})
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "public"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Public Rooms ({visiblePublicRooms.length})
          </button>
        </nav>
      </div>

      <div className="p-4">
        {roomsToShow.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm">
              {activeTab === "my"
                ? "You haven't joined any rooms yet"
                : "No public rooms available"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 h-full">
            {roomsToShow.map((room) => (
              <div
                key={room.id}
                onClick={() => handleRoomClick(room.name)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  state.currentRoomId === room.id
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600"
                    : "border-gray-200 dark:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {room.name}
                      </h3>
                      {room.isPrivate && (
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    {room.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatMemberCount(room.memberCount)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(room.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList;
