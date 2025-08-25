import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "../../contexts/ChatContext";
import MessageItem from "./MessageItem";

const NEAR_BOTTOM_PX = 300;
const NEAR_TOP_PX = 200;

// Persist scroll position per room across toggles/mounts
const roomScrollMemory = new Map<string, number>();

const MessageList: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { state, getRoomData, loadMoreMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // control flags
  const initialAppliedRef = useRef(false); // initial restore/bottom applied for this room view
  const isApplyingRef = useRef(false); // suppress scroll handler during programmatic scrolls
  const currentRoomRef = useRef(roomId); // guard against stale events

  // last known scrollTop we control (never read DOM at switch time)
  const lastKnownTopRef = useRef(0);

  // UI state
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const prevHeightRef = useRef(0);
  const prevTopRef = useRef(0);

  // Room data
  const roomData = useMemo(
    () => getRoomData(roomId),
    [roomId, state.messagesByRoom[roomId]]
  );
  let { messages, hasMore, isLoading } = roomData;

  const messagesLength = messages.length;
  const lastMessageId = useMemo(
    () => (messagesLength ? messages[messagesLength - 1].id : null),
    [messagesLength, messages]
  );

  // Utilities
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const saveMemory = (rid: string, top: number) => {
    roomScrollMemory.set(rid, top);
    lastKnownTopRef.current = top;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const recomputeBottomState = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const atBottom =
      c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX;
    setIsAtBottom(atBottom);
    if (atBottom) setUnseenCount(0);
  };

  // -------- ROOM CHANGE (runs before paint) --------
  useLayoutEffect(() => {
    const prevRoomId = currentRoomRef.current;

    // Save previous room's last known position from our ref (not the DOM)
    if (prevRoomId !== roomId) {
      saveMemory(prevRoomId, lastKnownTopRef.current);
    }

    // Prepare for new room
    currentRoomRef.current = roomId;
    initialAppliedRef.current = false;
    isApplyingRef.current = true; // block scroll handler until initial apply
    setShowLoadMore(false);
    setUnseenCount(0);
    setIsAtBottom(true);
  }, [roomId]);

  // -------- INITIAL APPLY (after messages exist) --------
  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (messagesLength === 0) return;

    const c = messagesContainerRef.current;
    if (!c) return;

    const apply = () => {
      const saved = roomScrollMemory.get(roomId);
      if (typeof saved === "number") {
        const maxTop = Math.max(0, c.scrollHeight - c.clientHeight);
        const nextTop = Math.min(saved, maxTop);
        c.scrollTop = nextTop;
        // record
        lastKnownTopRef.current = nextTop;
      } else {
        // first visit → bottom
        scrollToBottom("auto");
      }

      // mark done on next frame, then compute states and persist actual top
      requestAnimationFrame(() => {
        initialAppliedRef.current = true;
        isApplyingRef.current = false;
        recomputeBottomState();
        // persist whatever the browser settled on
        if (messagesContainerRef.current) {
          saveMemory(roomId, messagesContainerRef.current.scrollTop);
        }
      });
    };

    // double RAF to let layout settle (images, fonts)
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }, [messagesLength, roomId]);

  // -------- SCROLL HANDLER --------
  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;

    if (isApplyingRef.current || currentRoomRef.current !== roomId) return;

    // persist position
    saveMemory(roomId, c.scrollTop);

    const isNearTop = c.scrollTop < NEAR_TOP_PX;
    setShowLoadMore(isNearTop && hasMore && !isLoading);

    const atBottom =
      c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX;
    setIsAtBottom(atBottom);
    if (atBottom) setUnseenCount(0);
  };

  // -------- NEW TAIL MESSAGE --------
  useEffect(() => {
    const c = messagesContainerRef.current;
    if (!c || !initialAppliedRef.current) return;

    const atBottom =
      c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX;

    if (atBottom) {
      isApplyingRef.current = true;
      scrollToBottom("auto");
      requestAnimationFrame(() => {
        isApplyingRef.current = false;
        if (messagesContainerRef.current) {
          saveMemory(roomId, messagesContainerRef.current.scrollTop);
        }
        setUnseenCount(0);
        setIsAtBottom(true);
      });
    } else if (lastMessageId) {
      setUnseenCount((n) => n + 1);
    }
  }, [lastMessageId, roomId]);

  // -------- RESIZE OBSERVER --------
  useEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => recomputeBottomState());
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // -------- LOAD MORE SCROLL ADJUSTMENT --------
  useLayoutEffect(() => {
    if (!initialAppliedRef.current) return; // don't run during first mount
    if (!isLoadingMoreRef.current) return; // only if a load-more is in flight

    const c = messagesContainerRef.current;
    if (!c) return;

    // Wait one frame so DOM reflects the new nodes
    requestAnimationFrame(() => {
      const prevHeight = prevHeightRef.current;
      const prevTop = prevTopRef.current;
      const newHeight = c.scrollHeight;
      if (newHeight > prevHeight) {
        const nextTop = prevTop + (newHeight - prevHeight);
        c.scrollTop = nextTop;
        saveMemory(roomId, nextTop);
      }

      // cleanup
      isApplyingRef.current = false;

      const isNearTop = c.scrollTop < NEAR_TOP_PX;
      setShowLoadMore(isNearTop && hasMore && !isLoading);
    });
  }, [messagesLength, roomId]); // <- runs when messages actually prepend

  const handleLoadMore = async () => {
    const c = messagesContainerRef.current;
    if (!c || isLoading || !hasMore) return;

    isApplyingRef.current = true; // suppress scroll handler
    isLoadingMoreRef.current = true; // tell the effect to run a correction
    setShowLoadMore(false); // optimistic hide to avoid flicker

    // Snapshot BEFORE request
    prevHeightRef.current = c.scrollHeight;
    prevTopRef.current = c.scrollTop;

    await loadMoreMessages(roomId);
  };

  const handleJumpToNew = () => {
    isApplyingRef.current = true;
    scrollToBottom("smooth");
    requestAnimationFrame(() => {
      isApplyingRef.current = false;
      const c = messagesContainerRef.current;
      if (c) {
        saveMemory(roomId, c.scrollTop);
        setUnseenCount(0);
        setIsAtBottom(true);
      }
    });
  };

  return (
    <div className="relative h-full overflow-hidden">
      <div
        /* NOTE: no key={roomId} — we keep the same node and guard with refs */
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 h-full"
        onScroll={handleScroll}
        style={{ overflowAnchor: "none" }}
      >
        {/* Load more */}
        {showLoadMore && (
          <div className="text-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 
                     text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </span>
              ) : (
                "Load more messages"
              )}
            </button>
          </div>
        )}

        {/* List */}
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const showDate =
                !prevMessage ||
                formatDate(prevMessage.timestamp) !==
                  formatDate(message.timestamp);

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    isOwnMessage={message.userId === state.currentUser?.id}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* New message pill */}
      {!isAtBottom && unseenCount > 0 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <button
            onClick={handleJumpToNew}
            className="pointer-events-auto px-3 py-1.5 text-sm rounded-full shadow 
                       bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2"
          >
            <span>New message{unseenCount > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center justify-center text-xs bg-white/20 rounded-full px-2 py-0.5">
              {unseenCount}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageList;
