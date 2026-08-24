import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePromotion } from './usePromotions';
import {
  useApprovePromotion,
  useRejectPromotion,
  useCancelPromotion,
  useUpdateAndApprovePromotion,
  useReopenPromotion,
  useResubmitPromotion,
} from './usePromotionMutations';
import { StatusBadge } from '../../components/StatusBadge';
import { ChangeRequestSection } from '../changeRequests/ChangeRequestSection';
import { useModalA11y } from '../../hooks/useModalA11y';
import {
  PromotionExtraFields,
  PromotionExtraFieldsView,
  EXTRA_FIELDS_INITIAL,
  extraFieldsFromPromotion,
  extraFieldsToPayload,
} from './PromotionExtraFields';
import '../auth/AuthForm.css';
import './PromotionForm.css';
import './PromotionDetailPage.css';

function formatDate(iso) {
  return iso ? iso.slice(2, 10).replace(/-/g, '.') : '';
}

export function PromotionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const query = usePromotion(id);
  const promotion = query.data;

  const [editMode, setEditMode] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [condition, setCondition] = useState('');
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemSpec, setItemSpec] = useState('');
  const [extraFields, setExtraFields] = useState(EXTRA_FIELDS_INITIAL);

  const [modalType, setModalType] = useState(null); // null | 'reject' | 'cancel'
  const [reasonText, setReasonText] = useState('');
  const [actionError, setActionError] = useState(null);

  function closeReasonModal() {
    setModalType(null);
    setReasonText('');
  }
  const { firstFieldRef: reasonFieldRef, containerRef: reasonModalRef } = useModalA11y(closeReasonModal, !!modalType);

  const approveMutation = useApprovePromotion(id);
  const rejectMutation = useRejectPromotion(id);
  const cancelMutation = useCancelPromotion(id);
  const updateAndApproveMutation = useUpdateAndApprovePromotion(id);
  const reopenMutation = useReopenPromotion(id);
  const resubmitMutation = useResubmitPromotion(id);

  const header = (
    <header className="app-header">
      <div className="app-logo">CJ프레시웨이 프로모션 협업 앱</div>
      <h1 style={{ flex: 1 }}>프로모션 상세</h1>
      <button type="button" className="btn-cancel" onClick={() => navigate('/')}>
        목록
      </button>
    </header>
  );

  if (query.isLoading) {
    return (
      <div className="promotion-detail-page">
        {header}
        <p>불러오는 중...</p>
      </div>
    );
  }

  if (query.isError || !promotion) {
    return (
      <div className="promotion-detail-page">
        {header}
        <p>{query.error?.message ?? '프로모션을 찾을 수 없습니다'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  function enterEditMode() {
    setStartDate(promotion.start_date?.slice(0, 10) ?? '');
    setEndDate(promotion.end_date?.slice(0, 10) ?? '');
    setCondition(promotion.condition);
    setItems(promotion.items ?? []);
    setExtraFields(extraFieldsFromPromotion(promotion));
    setEditMode(true);
  }

  function itemsEqual(a, b) {
    const norm = (list) => list.map((i) => `${i.name}|${i.spec ?? ''}`).join(',');
    return norm(a) === norm(b);
  }

  function extraFieldsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function handleCancelEdit() {
    const isDirty =
      startDate !== (promotion.start_date?.slice(0, 10) ?? '') ||
      endDate !== (promotion.end_date?.slice(0, 10) ?? '') ||
      condition !== promotion.condition ||
      !itemsEqual(items, promotion.items ?? []) ||
      !extraFieldsEqual(extraFields, extraFieldsFromPromotion(promotion));
    if (isDirty && !window.confirm('편집 중인 내용이 사라집니다. 계속하시겠습니까?')) {
      return;
    }
    setEditMode(false);
  }

  function handleAddItem() {
    if (!itemName.trim()) return;
    setItems([...items, { name: itemName.trim(), spec: itemSpec.trim() || null }]);
    setItemName('');
    setItemSpec('');
  }

  function handleRemoveItem(index) {
    setItems(items.filter((_, i) => i !== index));
  }

  function handleSaveAndApprove() {
    setActionError(null);
    updateAndApproveMutation.mutate(
      { start_date: startDate, end_date: endDate, condition, items, ...extraFieldsToPayload(extraFields) },
      {
        onSuccess: () => setEditMode(false),
        onError: (err) => setActionError(err.message),
      }
    );
  }

  function handleResubmit() {
    setActionError(null);
    if (items.length === 0) {
      setActionError('대상 품목을 1개 이상 추가해야 합니다');
      return;
    }
    resubmitMutation.mutate(
      { start_date: startDate, end_date: endDate, condition, items, ...extraFieldsToPayload(extraFields) },
      {
        onSuccess: () => setEditMode(false),
        onError: (err) => setActionError(err.message),
      }
    );
  }

  function handleApprove() {
    setActionError(null);
    approveMutation.mutate(undefined, {
      onError: (err) => setActionError(err.message),
    });
  }

  function handleConfirmModal() {
    setActionError(null);
    const mutation = modalType === 'reject' ? rejectMutation : cancelMutation;
    mutation.mutate(reasonText, {
      onSuccess: closeReasonModal,
      onError: (err) => setActionError(err.message),
    });
  }

  const canReview = ['proposed', 'in_review'].includes(promotion.status);
  const canCancel = ['approved', 'active'].includes(promotion.status);
  const canReopen = ['closed', 'cancelled'].includes(promotion.status);
  const canResubmit = user?.role === 'partner' && promotion.status === 'rejected';

  function handleReopen() {
    setActionError(null);
    reopenMutation.mutate(undefined, {
      onError: (err) => setActionError(err.message),
    });
  }

  return (
    <div className="promotion-detail-page">
      {header}

      <div className="detail-info">
        <div className="detail-row">
          <span className="detail-label">상태</span>
          <StatusBadge status={promotion.status} />
        </div>
        <div className="detail-row">
          <span className="detail-label">제안자</span>
          <span>{promotion.proposer_company_name}</span>
        </div>

        {editMode ? (
          <>
            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="detail-start-date">시작일</label>
                <input
                  id="detail-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="detail-end-date">종료일</label>
                <input id="detail-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="form-field">
              <label id="detail-items-label">대상 품목</label>
              <div className="item-add-row">
                <input
                  type="text"
                  aria-labelledby="detail-items-label"
                  placeholder="품목명"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
                <input
                  type="text"
                  aria-label="규격(선택)"
                  placeholder="규격(선택)"
                  value={itemSpec}
                  onChange={(e) => setItemSpec(e.target.value)}
                />
                <button type="button" className="btn-primary" onClick={handleAddItem}>
                  + 추가
                </button>
              </div>
              <ul className="item-list">
                {items.map((item, index) => (
                  <li key={index}>
                    <span>
                      {item.name}
                      {item.spec ? ` (${item.spec})` : ''}
                    </span>
                    <button type="button" onClick={() => handleRemoveItem(index)}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="form-field">
              <label htmlFor="detail-condition">조건</label>
              <textarea id="detail-condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </div>

            <PromotionExtraFields values={extraFields} onChange={setExtraFields} />
          </>
        ) : (
          <>
            <div className="detail-row">
              <span className="detail-label">기간</span>
              <span>
                {formatDate(promotion.start_date)}~{formatDate(promotion.end_date)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">대상 품목</span>
              <span>{promotion.items?.map((i) => i.name).join(', ')}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">조건</span>
              <span>{promotion.condition}</span>
            </div>

            <PromotionExtraFieldsView promotion={promotion} />
          </>
        )}

        <div className="detail-row">
          <span className="detail-label">반려사유</span>
          <span>{promotion.reject_reason ?? '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">취소사유</span>
          <span>{promotion.cancel_reason ?? '-'}</span>
        </div>
      </div>

      {actionError && <div className="form-error" role="alert">{actionError}</div>}

      <div className="detail-actions">
        {user?.role === 'partner' ? (
          canResubmit ? (
            editMode ? (
              <>
                <button type="button" className="btn-primary" onClick={handleResubmit}>
                  재제출
                </button>
                <button type="button" className="btn-cancel" onClick={handleCancelEdit}>
                  편집 취소
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={enterEditMode}>
                수정 후 재제출
              </button>
            )
          ) : (
            <p className="ec01-notice">등록 후 직접 수정 불가 - 변경요청으로 안내</p>
          )
        ) : (
          <>
            {editMode && (
              <>
                <button type="button" className="btn-primary" onClick={handleSaveAndApprove}>
                  저장 후 승인
                </button>
                <button type="button" className="btn-cancel" onClick={handleCancelEdit}>
                  편집 취소
                </button>
              </>
            )}

            {!editMode && canReview && (
              <>
                <button type="button" className="btn-primary" onClick={handleApprove}>
                  승인
                </button>
                <button type="button" className="btn-cancel" onClick={enterEditMode}>
                  수정 후 승인
                </button>
                <button type="button" className="btn-cancel" onClick={() => setModalType('reject')}>
                  반려
                </button>
              </>
            )}

            {!editMode && canCancel && (
              <button type="button" className="btn-cancel" onClick={() => setModalType('cancel')}>
                프로모션 취소
              </button>
            )}

            {!editMode && canReopen && (
              <button type="button" className="btn-primary" onClick={handleReopen}>
                재오픈
              </button>
            )}
          </>
        )}
      </div>

      {modalType && (
        <div className="modal-overlay">
          <div className="modal-box" ref={reasonModalRef}>
            <h2 id="reason-modal-title">{modalType === 'reject' ? '반려 사유' : '프로모션 취소 사유'}</h2>
            <textarea
              ref={reasonFieldRef}
              aria-labelledby="reason-modal-title"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="사유를 입력하세요"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn-danger"
                disabled={!reasonText.trim()}
                onClick={handleConfirmModal}
              >
                확인
              </button>
              <button type="button" className="btn-cancel" onClick={closeReasonModal}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangeRequestSection promotionId={id} />
    </div>
  );
}
