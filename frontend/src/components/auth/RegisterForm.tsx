import { useState } from "react";
import { useChat } from "../../contexts/ChatContext";

interface AuthFormProps {
  onSuccess?: () => void;
}

const RegisterForm: React.FC<AuthFormProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, state } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) return;

    if (password !== confirmPassword) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password.trim());
      onSuccess?.(); // what's this?
    } catch (error) {
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordsMatch = password === confirmPassword;
  const showPasswordError = confirmPassword && !passwordsMatch;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
          placeholder="Choose a username"
          required
          disabled={isSubmitting}
          maxLength={50}
        />
      </div>

      <div>
        <label
          htmlFor="reg-email"
          className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Email Address
        </label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                   dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                   transition-colors"
          placeholder="Enter your email"
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label
          htmlFor="reg-password"
          className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Password
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                   dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                   transition-colors"
          placeholder="Create a password"
          required
          disabled={isSubmitting}
          minLength={6}
        />
        <p className="mt-1 text-xs text-left text-gray-500 dark:text-gray-400">
          Must be at least 6 characters long
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`w-full px-4 py-3 border rounded-lg 
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                   dark:bg-gray-700 dark:text-white dark:focus:ring-blue-400
                   transition-colors ${
                     showPasswordError
                       ? "border-red-300 dark:border-red-600"
                       : "border-gray-300 dark:border-gray-600"
                   }`}
          placeholder="Confirm your password"
          required
          disabled={isSubmitting}
        />
        {showPasswordError && (
          <p className="mt-1 text-xs text-left text-red-600 dark:text-red-400">
            Passwords do not match
          </p>
        )}
      </div>

      {state.error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          !username.trim() ||
          !email.trim() ||
          !password.trim() ||
          !passwordsMatch ||
          isSubmitting
        }
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 
                 disabled:cursor-not-allowed text-white font-medium rounded-lg 
                 transition-colors focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        {isSubmitting ? (
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
            Creating Account...
          </span>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
};

export default RegisterForm;
