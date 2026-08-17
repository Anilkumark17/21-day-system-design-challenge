import { useEffect, useState } from "react";

const getStreamUrl = () => {
  const token = localStorage.getItem("token");
  return `/api/notifications/stream?token=${token}`;
};

export const useNotifications = (enabled) => {
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      return undefined;
    }

    const source = new EventSource(getStreamUrl());

    source.addEventListener("connected", () => {
      setConnected(true);
    });

    source.addEventListener("new_message", (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [data, ...prev]);
    });

    source.addEventListener("daily_digest", (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [data, ...prev]);
    });

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [enabled]);

  const clearNotifications = () => setNotifications([]);

  return {
    notifications,
    connected,
    unreadCount: notifications.length,
    clearNotifications,
  };
};
