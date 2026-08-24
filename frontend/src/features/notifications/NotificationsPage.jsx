import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './useNotifications';
import './NotificationsPage.css';

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const query = useNotifications(50);
  const notifications = query.data ?? [];
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  function handleClick(notification) {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.promotion_id) {
      navigate(`/promotions/${notification.promotion_id}`);
    }
  }

  return (
    <div className="notifications-page">
      <AppHeader />
      <div className="notifications-page-toolbar">
        <h1>알림 전체보기</h1>
        <button
          type="button"
          className="btn-cancel"
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || notifications.every((n) => n.is_read)}
        >
          모두 읽음으로 표시
        </button>
      </div>

      {query.isLoading && <p>불러오는 중...</p>}
      {query.isError && <p role="alert">{query.error?.message}</p>}
      {query.isSuccess && notifications.length === 0 && <p>알림이 없습니다</p>}

      {query.isSuccess && notifications.length > 0 && (
        <ul className="notifications-list">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={n.is_read ? 'notifications-item' : 'notifications-item notifications-item-unread'}
                onClick={() => handleClick(n)}
              >
                <span className="notifications-item-message">{n.message}</span>
                <span className="notifications-item-time">{formatDateTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
