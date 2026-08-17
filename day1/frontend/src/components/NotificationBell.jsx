import { Link } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";

const getNotificationKey = (item, index) =>
  item.messageId || `${item.type}-${item.count || index}-${index}`;

const getNotificationText = (item) => {
  if (item.type === "daily_digest") {
    return item.message;
  }

  return (
    <>
      <strong>{item.from}</strong>: {item.preview}
    </>
  );
};

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
            <strong>Notifications</strong>
            <button type="button" onClick={clearNotifications}>
              Clear
            </button>
          </div>

          <ul className="notification-list">
            {notifications.map((item, index) => (
              <li key={getNotificationKey(item, index)}>
                <p>{getNotificationText(item)}</p>
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
