import { ChatProvider } from "./contexts/ChatContext";
import ChatContainer from "./components/chat/ChatContainer";

function App() {
  return (
    <ChatProvider>
      <ChatContainer />
    </ChatProvider>
  );
}

export default App;
