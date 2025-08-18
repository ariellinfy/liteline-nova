import { ChatProvider } from "./contexts/ChatContext";
import ChatContainer from "./components/chat/ChatContainer";
import "./App.css";

function App() {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <ChatContainer />
      </div>
    </ChatProvider>
  );
}

export default App;
