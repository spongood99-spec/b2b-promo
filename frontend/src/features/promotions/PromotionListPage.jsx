import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePromotions } from './usePromotions';
import { StatusBadge } from '../../components/StatusBadge';
import { AppHeader } from '../../components/AppHeader';
import './PromotionListPage.css';

const STATUS_OPTIONS = [
  ['', '전체'],
  ['proposed', '제안됨'],
  ['in_review', '검토중'],
  ['approved', '승인됨'],
  ['rejected', '반려됨'],
  ['active', '진행중'],
  ['closed', '종료'],
  ['cancelled', '취소됨'],
];

function formatDate(iso) {
  return iso ? iso.slice(2, 10).replace(/-/g, '.') : '';
}

export function PromotionListPage() {
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const query = usePromotions(status);

  return (
    <div className="promotion-list-page">
      <AppHeader activeNav="list" />

      <div className="promotion-list-toolbar">
        <select
          className="status-filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {user?.role === 'partner' && (
          <button
            type="button"
            className="btn-primary btn-register"
            onClick={() => navigate('/promotions/new')}
          >
            + 프로모션 등록
          </button>
        )}
      </div>

      {query.isLoading && <p>불러오는 중...</p>}
      {query.isError && <p>{query.error?.message}</p>}
      {query.isSuccess && query.data.length === 0 && <p>등록된 프로모션이 없습니다</p>}

      {query.isSuccess && query.data.length > 0 && (
        <table className="promotion-table">
          <thead>
            <tr>
              <th>제목/품목</th>
              <th>기간</th>
              <th>상태</th>
              <th>제안자(소속사)</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((promotion) => (
              <tr key={promotion.id} onClick={() => navigate(`/promotions/${promotion.id}`)}>
                <td>
                  {promotion.items?.[0]?.name}
                  {promotion.items?.length > 1 ? ` 외 ${promotion.items.length - 1}건` : ''}
                </td>
                <td>
                  {formatDate(promotion.start_date)}~{formatDate(promotion.end_date)}
                </td>
                <td>
                  <StatusBadge status={promotion.status} />
                </td>
                <td>{promotion.proposer_company_name ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
