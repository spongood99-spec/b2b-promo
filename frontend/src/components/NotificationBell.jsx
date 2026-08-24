import { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const query = useNotifications(5);
  const notifications = query.data ?? [];

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleClick(notification) {
    setOpen(false);
    if (notification.promotion_id) {
      navigate(`/promotions/${notification.promotion_id}`);
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button type="button" className="btn-logout" ref={triggerRef} onClick={() => setOpen(!open)}>
        알림 {notifications.length > 0 ? `(${notifications.length})` : ''}
      </button>
      {open && (
        <div className="notification-dropdown">
          {query.isLoading && <p className="notification-empty">불러오는 중...</p>}
          {query.isError && <p className="notification-empty">{query.error?.message}</p>}
          {query.isSuccess && notifications.length === 0 && (
            <p className="notification-empty">알림이 없습니다</p>
          )}
          {query.isSuccess && notifications.length > 0 && (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => handleClick(n)}>
                    <span className="notification-message">{n.message}</span>
                    <span className="notification-time">{formatTime(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
