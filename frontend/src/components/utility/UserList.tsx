import React from "react";
import { useChat } from "../../contexts/ChatContext";

const UserList: React.FC = () => {
  const { state } = useChat();

  const formatLastSeen = (lastSeen: string): string => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Room Users ({state.roomPresences.length})
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {state.roomPresences.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No users in room
          </p>
        ) : (
          state.roomPresences
            .sort((a, b) => {
              // Sort by online status first, then by username
              if (a.status !== b.status) {
                return a.status === "online" ? -1 : 1;
              }
              return a.username.localeCompare(b.username);
            })
            .map((presence) => (
              <div
                key={presence.userId}
                className="flex items-center justify-between py-1"
                title={
                  presence.status === "offline"
                    ? `Last seen: ${formatLastSeen(presence.lastSeen)}`
                    : "Currently online"
                }
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      presence.status === "online"
                        ? "bg-green-500"
                        : "bg-gray-400"
                    }`}
                  ></div>
                  <span
                    className={`text-sm truncate ${
                      presence.userId === state.currentUser?.id
                        ? "font-medium text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {presence.userId === state.currentUser?.id
                      ? "You"
                      : presence.username}
                  </span>
                </div>

                {presence.status === "offline" && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {formatLastSeen(presence.lastSeen)}
                  </span>
                )}
              </div>
            ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Online:{" "}
            {state.roomPresences.filter((p) => p.status === "online").length}
          </span>
          <span>Total: {state.roomPresences.length}</span>
        </div>
      </div>
    </div>
  );
};

export default UserList;
