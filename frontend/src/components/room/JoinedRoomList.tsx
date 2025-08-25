import React from "react";
import { useChat } from "../../contexts/ChatContext";

const JoinedRoomList: React.FC = () => {
  const { state, switchToRoom } = useChat();
  const rooms = state.userRooms || [];

  const formatMemberCount = (count?: number) =>
    !count ? "0" : count === 1 ? "1" : `${count}`;

  const sorted = [...rooms].sort((a, b) => {
    // current room first, then alpha
    if (a.id === state.currentRoomId) return -1;
    if (b.id === state.currentRoomId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Joined Rooms ({rooms.length})
      </h3>

      <div className="space-y-2 pr-1 max-h-64 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No rooms joined yet
          </p>
        ) : (
          sorted.map((room) => (
            <button
              key={room.id}
              onClick={() => switchToRoom(room.name)}
              className="w-full flex items-center justify-between bg-blue-100/50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg px-4 py-2"
              title={room.description || room.name}
            >
              <div className="flex items-center space-x-2 min-w-0 ">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    room.id === state.currentRoomId
                      ? "bg-blue-500"
                      : "bg-gray-400"
                  }`}
                />
                <span
                  className={`text-sm truncate ${
                    room.id === state.currentRoomId
                      ? "font-medium text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {room.name}
                </span>
                {room.isPrivate && (
                  <svg
                    className="w-3 h-3 text-gray-400 flex-shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {formatMemberCount(room.memberCount)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default JoinedRoomList;
