import React, { useEffect, useMemo, useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import { UserPresence } from "../../types";

const UserList: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { state, getRoomPresences } = useChat();
  const roomPresences: UserPresence[] = getRoomPresences(roomId);

  // 🔔 Re-render this component periodically so relative times update.
  // We pause updates when the tab is hidden to save work.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id) return;
      // 30s feels snappy for “x m ago” without being chatty.
      id = setInterval(() => setTick((t) => t + 1), 30_000);
    };
    const stop = () => {
      if (!id) return;
      clearInterval(id);
      id = null;
    };

    if (document.visibilityState === "visible") start();

    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else {
        // Force an immediate refresh when user returns
        setTick((t) => t + 1);
        start();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const formatLastSeen = (lastSeen: string): string => {
    void tick;
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

  const sortedPresences = useMemo(() => {
    // clone before sort to avoid mutating state
    return [...roomPresences].sort((a, b) => {
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }, [roomPresences]);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Room Users ({roomPresences.length})
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {roomPresences.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No users in room
          </p>
        ) : (
          sortedPresences.map((presence) => (
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
            Online: {roomPresences.filter((p) => p.status === "online").length}
          </span>
          <span>Total: {roomPresences.length}</span>
        </div>
      </div>
    </div>
  );
};

export default UserList;
