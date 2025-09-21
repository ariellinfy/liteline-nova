import { useEffect, useState } from "react";
import { useChat } from "../../contexts/ChatContext";
import { ApiError } from "../../types";

const JoinRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  isPrivate?: boolean;
}> = ({
  isOpen,
  onClose,
  roomId: initialRoomId,
  isPrivate: initialIsPrivate, // need a machism to check if a room requires passcode
}) => {
  const [roomId, setRoomId] = useState(initialRoomId || "");
  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceAskPasscode, setForceAskPasscode] = useState(false);
  const { joinRoom, state } = useChat();

  const showPasscode = forceAskPasscode || passcode.length > 0;

  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    setIsSubmitting(true);
    try {
      await joinRoom(roomId.trim(), passcode.trim() || undefined);
      setRoomId("");
      setPasscode("");
      setForceAskPasscode(false);
      onClose();
    } catch (error) {
      console.log(error, error.code);
      if (error instanceof ApiError && error.code === "PASSCODE_REQUIRED") {
        setForceAskPasscode(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const passcodeLabelRequiredStar =
    state.error?.code === "PASSCODE_REQUIRED" ? "*" : "";

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Join Room
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="w-6 h-6"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="join-room-id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Room ID *
            </label>
            <input
              id="join-room-id"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                       dark:bg-gray-700 dark:text-white font-mono"
              placeholder="Enter room ID"
              required
              disabled={isSubmitting}
              readOnly={!!initialRoomId}
            />
          </div>

          {showPasscode && (
            <div>
              <label
                htmlFor="join-passcode"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Passcode {passcodeLabelRequiredStar}
              </label>
              <input
                id="join-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         dark:bg-gray-700 dark:text-white"
                placeholder="Enter room passcode"
                required={state.error?.code === "PASSCODE_REQUIRED"}
                disabled={isSubmitting}
              />
              {!forceAskPasscode && !passcode && (
                <p className="mt-1 text-xs text-gray-500">
                  Leave blank if the room is public.
                </p>
              )}
            </div>
          )}

          {state.error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {state.error.message}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                       hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!roomId.trim() || isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                       disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinRoomModal;
