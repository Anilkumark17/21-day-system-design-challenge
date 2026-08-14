import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMessageSocket } from "../hooks/useMessageSocket";

const Message = ({ receiverEmail, contactId, contactName }) => {
  const { isAuthenticated, user } = useAuth();
  const [text, setText] = useState("");
  const { messages, connected, sendMessage } = useMessageSocket(
    contactId,
    user?.id
  );

  if (!isAuthenticated) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessage(receiverEmail, text.trim());
    setText("");
  };

  return (
    <div className="message-box">
      <h3>Chat with {contactName || receiverEmail}</h3>
      <p className={connected ? "status-online" : "status-offline"}>
        {connected ? "Connected" : "Connecting..."}
      </p>

      <ul className="message-list">
        {messages.length === 0 && (
          <li className="muted">No messages yet. Start the conversation.</li>
        )}
        {messages.map((msg) => (
          <li
            key={msg.id}
            className={`message-item ${msg.isMine ? "message-sent" : "message-received"}`}
          >
            <strong>{msg.isMine ? "You" : contactName || receiverEmail}</strong>
            <p>{msg.content}</p>
            <span className="muted">
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          placeholder="Type a message..."
          onChange={(e) => setText(e.target.value)}
          disabled={!connected}
        />
        <button type="submit" className="btn-primary" disabled={!connected}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Message;
