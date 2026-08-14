import { useEffect, useRef, useState } from "react";

const getSocketUrl = () => {
  const token = localStorage.getItem("token");
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.DEV
    ? window.location.host
    : (import.meta.env.VITE_WS_URL || "localhost:5000").replace(/^https?:\/\//, "");

  return `${protocol}://${host}/ws?token=${token}`;
};

export const useMessageSocket = (contactId, currentUserId) => {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!contactId) return undefined;

    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const socket = new WebSocket(getSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: "join", contactId }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "history") {
        setMessages(data.messages);
      }

      if (data.type === "message") {
        setMessages((prev) => {
          const exists = prev.some((item) => item.id === data.message.id);
          return exists ? prev : [...prev, data.message];
        });
      }
    };

    socket.onclose = () => setConnected(false);

    return () => socket.close();
  }, [contactId]);

  const sendMessage = (receiverEmail, content) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "send",
        contactId,
        receiverEmail,
        content,
      })
    );
  };

  const messagesWithOwnership = messages.map((msg) => ({
    ...msg,
    isMine: msg.senderId === currentUserId,
  }));

  return { messages: messagesWithOwnership, connected, sendMessage };
};
