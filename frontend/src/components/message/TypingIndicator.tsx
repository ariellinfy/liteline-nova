import React from "react";
import { useChat } from "../../contexts/ChatContext";

const TypingIndicator: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { getRoomTyping } = useChat();
  const typingUsers = getRoomTyping(roomId).filter((user) => user.isTyping);

  if (typingUsers.length === 0) {
    return <div className="py-1"></div>;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    } else {
      return `${typingUsers.length} users are typing...`;
    }
  };

  return (
    <div className="flex justify-start">
      <div className="px-1 py-1">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getTypingText()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
