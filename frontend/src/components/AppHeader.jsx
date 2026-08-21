import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ChangePasswordModal } from './ChangePasswordModal';
import { NotificationBell } from './NotificationBell';
import './AppHeader.css';

export function AppHeader({ activeNav }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [showChangePassword, setShowChangePassword] = useState(false);

  function handleLogout() {
    useAuthStore.getState().clearAuth();
    navigate('/login');
  }

  return (
    <header className="app-header">
      <div className="app-logo">CJ프레시웨이 프로모션 협업 앱</div>
      <nav className="app-nav">
        <Link to="/" className={activeNav === 'list' ? 'app-nav-current' : ''}>
          프로모션 목록
        </Link>
        <Link to="/calendar" className={activeNav === 'calendar' ? 'app-nav-current' : ''}>
          캘린더
        </Link>
      </nav>
      <div className="app-header-right">
        <span className="app-user-info">
          {user?.company_name} / {user?.email}
        </span>
        <NotificationBell />
        <button type="button" className="btn-logout" onClick={() => setShowChangePassword(true)}>
          비밀번호 변경
        </button>
        <button type="button" className="btn-logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </header>
  );
}
