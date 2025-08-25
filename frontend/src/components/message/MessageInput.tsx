import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useChat } from "../../contexts/ChatContext";
import TypingIndicator from "./TypingIndicator";

const MessageInput: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [message, setMessage] = useState("");
  const { sendMessage, startTyping, stopTyping } = useChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount / room change
  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId]);

  useLayoutEffect(() => {
    autoResize(true);
  }, [message, roomId]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage(message.trim());
      setMessage("");
      stopTyping(roomId);

      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Focus back after sending
      inputRef.current?.focus();
      // if (inputRef.current) {
      //   inputRef.current.style.height = "auto";
      //   inputRef.current.scrollTop = 0; // reset scrollbar
      //   inputRef.current.focus();
      // }
      // autoResize(); // collapse back to one line after send
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    // autoResize();

    if (value.trim()) {
      startTyping(roomId);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(roomId);
      }, 1000);
    } else {
      stopTyping(roomId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // const autoResize = () => {
  //   const el = inputRef.current;
  //   if (!el) return;
  //   el.style.height = "auto";
  //   const maxHeight = 6 * 24; // ~6 lines
  //   el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";

  //   // If content shrinks, also reset scroll
  //   if (el.scrollHeight <= maxHeight) {
  //     el.scrollTop = 0;
  //   }
  // };

  const autoResize = (resetScroll = false) => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = "auto";

    // Use computed line-height so it matches your styles
    const lh = parseFloat(getComputedStyle(el).lineHeight || "24") || 24;
    const maxHeight = lh * 6; // ~6 lines
    const newHeight = Math.min(el.scrollHeight, maxHeight);

    el.style.height = `${newHeight}px`;
    // Only show scrollbar if content exceeds the cap
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";

    if (resetScroll) {
      // Ensure no lingering scrollbar thumb is visible
      el.scrollTop = 0;
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-4 pb-3 pt-2 bg-white dark:bg-gray-800">
      <TypingIndicator roomId={roomId} />
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          maxLength={500}
          rows={1}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                     dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                     transition-colors resize-none leading-6 overflow-y-auto"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 
                     disabled:cursor-not-allowed text-white rounded-lg transition-colors
                     flex items-center space-x-2"
        >
          <span>Send</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
      <p className="text-[0.65rem] text-gray-500 dark:text-gray-400 mt-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
};

export default MessageInput;
