import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { PromotionListPage } from '../features/promotions/PromotionListPage';
import { PromotionDetailPage } from '../features/promotions/PromotionDetailPage';
import { PromotionForm } from '../features/promotions/PromotionForm';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { ProtectedRoute } from '../components/ProtectedRoute';

function NotFoundPage() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <p>존재하지 않는 페이지입니다.</p>
      <Link to="/">목록으로 돌아가기</Link>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PromotionListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/promotions/new"
          element={
            <ProtectedRoute>
              <PromotionForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/promotions/:id"
          element={
            <ProtectedRoute>
              <PromotionDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
