import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChangeRequests, useCreateChangeRequest, useUpdateChangeRequestStatus } from './useChangeRequests';

const APPLY_STATUS_LABELS = { pending: '대기', applied: '반영완료', rejected: '반영거부' };

export function ChangeRequestSection({ promotionId }) {
  const user = useAuthStore((s) => s.user);
  const query = useChangeRequests(promotionId);
  const createMutation = useCreateChangeRequest(promotionId);
  const updateMutation = useUpdateChangeRequestStatus(promotionId);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);

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

  // ponytail: no created_at column, relies on insertion-order SELECT — reverse assumes DB returns oldest-first
  const history = [...(query.data ?? [])].reverse();

  return (
    <div className="cr-section">
      <h2>변경요청</h2>

      {user?.role === 'partner' && (
        <form className="auth-form cr-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-field">
            <label>변경 내용 입력</label>
            <input type="text" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            등록
          </button>
        </form>
      )}

      {user?.role !== 'partner' && error && <div className="form-error">{error}</div>}

      <ul className="cr-history">
        {history.map((cr) => (
          <li key={cr.id} className="cr-item">
            <div className="cr-item-meta">
              <span>{cr.requester_company_name}</span>
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
