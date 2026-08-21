import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../features/notifications/useNotifications';
import './NotificationBell.css';

function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const query = useNotifications(5);
  const notifications = query.data ?? [];

  function handleClick(notification) {
    setOpen(false);
    if (notification.promotion_id) {
      navigate(`/promotions/${notification.promotion_id}`);
    }
  }

  return (
    <div className="notification-bell">
      <button type="button" className="btn-logout" onClick={() => setOpen(!open)}>
        알림 {notifications.length > 0 ? `(${notifications.length})` : ''}
      </button>
      {open && (
        <div className="notification-dropdown">
          {notifications.length === 0 ? (
            <p className="notification-empty">알림이 없습니다</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} onClick={() => handleClick(n)}>
                  <span className="notification-message">{n.message}</span>
                  <span className="notification-time">{formatTime(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
