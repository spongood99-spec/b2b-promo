import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChangeRequests, useCreateChangeRequest, useUpdateChangeRequestStatus } from './useChangeRequests';
import { formatDateTime } from '../../utils/formatDateTime';

const APPLY_STATUS_LABELS = { pending: '대기', applied: '반영완료', rejected: '반영거부' };
const APPLY_STATUS_ORDER = ['pending', 'applied', 'rejected'];

const CR_SORT_OPTIONS = [
  { key: 'default', label: '등록순' },
  { key: 'requester', label: '요청자', getValue: (cr) => cr.requester_company_name ?? '' },
  { key: 'status', label: '반영여부', getValue: (cr) => APPLY_STATUS_ORDER.indexOf(cr.apply_status) },
];

export function ChangeRequestSection({ promotionId }) {
  const user = useAuthStore((s) => s.user);
  const query = useChangeRequests(promotionId);
  const createMutation = useCreateChangeRequest(promotionId);
  const updateMutation = useUpdateChangeRequestStatus(promotionId);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('default');
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    createMutation.mutate(content, {
      onSuccess: () => setContent(''),
      onError: (err) => setError(err.message),
    });
  }

  function handleUpdateStatus(id, apply_status) {
    setError(null);
    updateMutation.mutate({ id, apply_status }, { onError: (err) => setError(err.message) });
  }

  if (query.isLoading) return <p>변경요청 이력을 불러오는 중...</p>;
  if (query.isError) return <p>{query.error?.message}</p>;

  // 백엔드는 created_at 오름차순(오래된 것 먼저)으로 반환하므로, 기본 정렬(최신순)을 위해 뒤집는다.
  const baseHistory = [...(query.data ?? [])].reverse();
  const sortOption = CR_SORT_OPTIONS.find((o) => o.key === sortKey);
  const history =
    sortKey === 'default'
      ? baseHistory
      : (() => {
          const sorted = [...baseHistory].sort((a, b) => {
            const va = sortOption.getValue(a);
            const vb = sortOption.getValue(b);
            if (va < vb) return -1;
            if (va > vb) return 1;
            return 0;
          });
          return sortDir === 'desc' ? sorted.reverse() : sorted;
        })();

  return (
    <div className="cr-section">
      <h2>변경요청</h2>

      {user?.role === 'partner' && (
        <form className="auth-form cr-form" onSubmit={handleSubmit}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-field">
            <label htmlFor="change-request-content">변경 내용 입력</label>
            <input
              id="change-request-content"
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            등록
          </button>
        </form>
      )}

      {user?.role !== 'partner' && error && <div className="form-error" role="alert">{error}</div>}

      <div className="cr-sort-bar">
        {CR_SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="cr-sort-btn"
            onClick={() => handleSort(option.key)}
          >
            {option.label}
            {sortKey === option.key && option.key !== 'default' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
          </button>
        ))}
      </div>

      <ul className="cr-history">
        {history.map((cr) => (
          <li key={cr.id} className="cr-item">
            <div className="cr-item-meta">
              <span>{cr.requester_company_name}</span>
              <span className="cr-item-time">{formatDateTime(cr.created_at)}</span>
              {cr.is_post_approval_change && <span className="cr-tag">승인후변경</span>}
            </div>
            <div className="cr-item-content">{cr.content}</div>
            <div className="cr-item-status">
              반영여부: {APPLY_STATUS_LABELS[cr.apply_status]}
              {user?.role === 'cj_freshway' && cr.apply_status === 'pending' && (
                <>
                  <button type="button" className="btn-primary" onClick={() => handleUpdateStatus(cr.id, 'applied')}>
                    반영완료
                  </button>
                  <button type="button" className="btn-cancel" onClick={() => handleUpdateStatus(cr.id, 'rejected')}>
                    반영거부
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
