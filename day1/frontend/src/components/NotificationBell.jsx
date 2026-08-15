import { Link } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";

const NotificationBell = () => {
  const { notifications, unreadCount, connected, clearNotifications } =
    useNotifications(true);

  return (
    <div className="notification-bell">
      <button type="button" className="btn-secondary notification-button">
        Notifications {unreadCount > 0 && `(${unreadCount})`}
      </button>
      <span
        className={`notification-dot ${connected ? "online" : "offline"}`}
        title={connected ? "SSE connected" : "SSE disconnected"}
      />

      {notifications.length > 0 && (
        <div className="notification-panel">
          <div className="notification-header">
            <strong>New messages</strong>
            <button type="button" onClick={clearNotifications}>
              Clear
            </button>
          </div>

          <ul className="notification-list">
            {notifications.map((item) => (
              <li key={item.messageId}>
                <p>
                  <strong>{item.from}</strong>: {item.preview}
                </p>
                {item.contactId && (
                  <Link to={`/contacts/${item.contactId}`}>Open chat</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
