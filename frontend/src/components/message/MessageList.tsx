import React, { useEffect, useRef } from "react";
import { useChat } from "../../contexts/ChatContext";
import MessageItem from "./MessageItem";
import TypingIndicator from "./TypingIndicator";

const MessageList: React.FC = () => {
  const { state } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {state.messages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        state.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwnMessage={message.userId === state.currentUser?.id}
          />
        ))
      )}

      <TypingIndicator />
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
