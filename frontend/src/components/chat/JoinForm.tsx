import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useChat } from "../../contexts/ChatContext";

const JoinForm: React.FC = () => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { joinRoom } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !roomId.trim()) {
      return;
    }

    setIsJoining(true);

    try {
      const userId = uuidv4();
      await joinRoom(roomId.trim(), userId, username.trim());
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const generateRoomId = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(roomId);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Join Chat Room
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your details to start chatting
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                       transition-colors"
              placeholder="Enter your username"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label
              htmlFor="roomId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Room ID
            </label>
            <div className="flex gap-2">
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                         transition-colors font-mono"
                placeholder="ROOM123"
                maxLength={20}
                required
              />
              <button
                type="button"
                onClick={generateRoomId}
                className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg 
                         transition-colors flex-shrink-0 text-sm font-medium"
              >
                Generate
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Share this ID with others to join the same room
            </p>
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !roomId.trim() || isJoining}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     disabled:cursor-not-allowed text-white font-medium rounded-lg 
                     transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isJoining ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Joining...
              </span>
            ) : (
              "Join Room"
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Your messages will be visible to all users in the same room
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinForm;
