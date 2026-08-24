import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePromotions, usePromotionStats } from './usePromotions';
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

const STATUS_ORDER = ['proposed', 'in_review', 'approved', 'rejected', 'active', 'closed', 'cancelled'];

const COLUMNS = [
  { key: 'title', label: '제목/품목', getValue: (p) => p.items?.[0]?.name ?? '' },
  { key: 'period', label: '기간', getValue: (p) => p.start_date ?? '' },
  { key: 'status', label: '상태', getValue: (p) => STATUS_ORDER.indexOf(p.status) },
  { key: 'proposer', label: '제안자(소속사)', getValue: (p) => p.proposer_company_name ?? '' },
];

function formatDate(iso) {
  return iso ? iso.slice(2, 10).replace(/-/g, '.') : '';
}

function sortPromotions(promotions, sortKey, sortDir) {
  if (!sortKey) return promotions;
  const column = COLUMNS.find((c) => c.key === sortKey);
  const sorted = [...promotions].sort((a, b) => {
    const va = column.getValue(a);
    const vb = column.getValue(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}

const PAGE_SIZE = 20;

export function PromotionListPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const statsQuery = usePromotionStats();
  const stats = statsQuery.data ?? {};
  const query = usePromotions(status, page, PAGE_SIZE, q);
  const promotions = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setQ(qInput.trim());
    setPage(1);
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="promotion-list-page">
      <AppHeader activeNav="list" />

      {statsQuery.isSuccess && (
        <div className="promotion-stats-bar">
          {user?.role === 'cj_freshway' ? (
            <span className="promotion-stat">
              승인 대기 <strong>{(stats.proposed ?? 0) + (stats.in_review ?? 0)}</strong>건
            </span>
          ) : (
            <span className="promotion-stat">
              재제출 필요(반려됨) <strong>{stats.rejected ?? 0}</strong>건
            </span>
          )}
          <span className="promotion-stat">
            진행중 <strong>{stats.active ?? 0}</strong>건
          </span>
        </div>
      )}

      <div className="promotion-list-toolbar">
        <form className="promotion-list-filters" onSubmit={handleSearchSubmit}>
          <select
            className="status-filter-select"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="visually-hidden" htmlFor="promotion-search">회사명/품목명/조건 검색</label>
          <input
            id="promotion-search"
            type="search"
            className="promotion-search-input"
            placeholder="회사명/품목명/조건 검색"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />

          <button type="submit" className="btn-query">
            조회
          </button>
        </form>

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
      {query.isSuccess && promotions.length === 0 && (
        <p>{status || q ? '조건에 맞는 프로모션이 없습니다' : '등록된 프로모션이 없습니다'}</p>
      )}

      {query.isSuccess && promotions.length > 0 && (
        <table className="promotion-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="sortable-th"
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                  {sortKey === column.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortPromotions(promotions, sortKey, sortDir).map((promotion) => (
              <tr key={promotion.id}>
                <td>
                  <Link className="row-link" to={`/promotions/${promotion.id}`}>
                    {promotion.items?.[0]?.name || '제목 없음'}
                    {promotion.items?.length > 1 ? ` 외 ${promotion.items.length - 1}건` : ''}
                  </Link>
                </td>
                <td>
                  <Link className="row-link" to={`/promotions/${promotion.id}`}>
                    {formatDate(promotion.start_date)}~{formatDate(promotion.end_date)}
                  </Link>
                </td>
                <td>
                  <Link className="row-link" to={`/promotions/${promotion.id}`}>
                    <StatusBadge status={promotion.status} />
                  </Link>
                </td>
                <td>
                  <Link className="row-link" to={`/promotions/${promotion.id}`}>
                    {promotion.proposer_company_name ?? '-'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {query.isSuccess && total > 0 && (
        <div className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {'<'}
          </button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {'>'}
          </button>
        </div>
      )}
    </div>
  );
}
