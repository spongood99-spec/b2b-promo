import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCreatePromotion } from './usePromotionMutations';
import { PromotionExtraFields, EXTRA_FIELDS_INITIAL, extraFieldsToPayload } from './PromotionExtraFields';
import '../auth/AuthForm.css';
import './PromotionForm.css';

export function PromotionForm() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const createPromotion = useCreatePromotion();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [condition, setCondition] = useState('');
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemSpec, setItemSpec] = useState('');
  const [extraFields, setExtraFields] = useState(EXTRA_FIELDS_INITIAL);
  const [formError, setFormError] = useState(null);

  if (user?.role !== 'partner') return <Navigate to="/" replace />;

  function handleAddItem() {
    if (!itemName.trim()) return;
    setItems([...items, { name: itemName.trim(), spec: itemSpec.trim() || null }]);
    setItemName('');
    setItemSpec('');
  }

  function handleRemoveItem(index) {
    setItems(items.filter((_, i) => i !== index));
  }

  function handleCancel() {
    const isDirty =
      startDate ||
      endDate ||
      condition.trim() ||
      items.length > 0 ||
      itemName.trim() ||
      itemSpec.trim() ||
      Object.values(extraFields).some((v) => v.trim());
    if (isDirty && !window.confirm('작성 중인 내용이 사라집니다. 계속하시겠습니까?')) {
      return;
    }
    navigate('/');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!startDate || !endDate || !condition.trim() || items.length === 0) {
      setFormError('기간/대상 품목/조건은 필수 입력입니다');
      return;
    }
    setFormError(null);
    createPromotion.mutate(
      { start_date: startDate, end_date: endDate, condition, items, ...extraFieldsToPayload(extraFields) },
      {
        onSuccess: () => navigate('/'),
        onError: (err) => setFormError(err.message),
      }
    );
  }

  return (
    <div className="promotion-form-page">
      <div className="promotion-form-header">
        <h1>프로모션 등록</h1>
        <button type="button" className="btn-cancel" onClick={handleCancel}>
          취소
        </button>
      </div>

      <form className="auth-form promotion-form" onSubmit={handleSubmit}>
        {formError && <div className="form-error">{formError}</div>}

        <div className="form-field-row">
          <div className="form-field">
            <label htmlFor="promotion-start-date">시작일</label>
            <input
              id="promotion-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="promotion-end-date">종료일</label>
            <input id="promotion-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label id="promotion-items-label">대상 품목</label>
          <div className="item-add-row">
            <input
              type="text"
              aria-labelledby="promotion-items-label"
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
          <label htmlFor="promotion-condition">조건</label>
          <textarea id="promotion-condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
        </div>

        <PromotionExtraFields values={extraFields} onChange={setExtraFields} />

        <button type="submit" className="btn-primary" disabled={createPromotion.isPending}>
          제안 등록
        </button>
      </form>
    </div>
  );
}
