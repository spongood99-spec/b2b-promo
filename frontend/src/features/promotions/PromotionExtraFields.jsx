import './PromotionExtraFields.css';

export const DISCOUNT_TYPES = ['정률할인', '정액할인', '사은품', '1+1', '기타'];
export const PROMOTION_TYPES = ['신제품출시', '시즌행사', '재고소진', '단순할인', '기타'];

export const EXTRA_FIELD_LABELS = {
  discount_type: '할인유형',
  discount_value: '할인값',
  partner_cost_share_pct: '협력사 부담율(%)',
  moq: '최소주문수량',
  available_qty: '공급가능수량',
  lead_time_days: '리드타임(일)',
  contact_name: '담당자명',
  contact_phone: '담당자 연락처',
  origin_and_cert: '원산지/인증정보',
  shelf_life_and_storage: '유통기한/보관조건',
  promotion_type: '프로모션유형',
  target_channel: '적용채널',
  attachment_url: '첨부링크',
};

const NUMERIC_FIELDS = ['discount_value', 'partner_cost_share_pct', 'moq', 'available_qty', 'lead_time_days'];

export const EXTRA_FIELDS_INITIAL = {
  discount_type: '',
  discount_value: '',
  partner_cost_share_pct: '',
  moq: '',
  available_qty: '',
  lead_time_days: '',
  contact_name: '',
  contact_phone: '',
  origin_and_cert: '',
  shelf_life_and_storage: '',
  promotion_type: '',
  target_channel: '',
  attachment_url: '',
};

export function extraFieldsFromPromotion(promotion) {
  const result = {};
  for (const field of Object.keys(EXTRA_FIELD_LABELS)) {
    result[field] = promotion?.[field] ?? '';
  }
  return result;
}

export function extraFieldsToPayload(values) {
  const payload = {};
  for (const field of Object.keys(EXTRA_FIELD_LABELS)) {
    const raw = values[field];
    if (raw === '' || raw === undefined) {
      payload[field] = null;
    } else if (NUMERIC_FIELDS.includes(field)) {
      payload[field] = Number(raw);
    } else {
      payload[field] = raw;
    }
  }
  return payload;
}

export function PromotionExtraFields({ values, onChange }) {
  function set(field, value) {
    onChange({ ...values, [field]: value });
  }

  return (
    <details className="extra-fields">
      <summary>상세 조건 (선택)</summary>
      <div className="extra-fields-grid">
        <div className="form-field">
          <label>할인유형</label>
          <select value={values.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
            <option value="">선택 안 함</option>
            {DISCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>할인값</label>
          <input type="number" value={values.discount_value} onChange={(e) => set('discount_value', e.target.value)} />
        </div>
        <div className="form-field">
          <label>협력사 부담율(%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={values.partner_cost_share_pct}
            onChange={(e) => set('partner_cost_share_pct', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>최소주문수량</label>
          <input type="number" value={values.moq} onChange={(e) => set('moq', e.target.value)} />
        </div>
        <div className="form-field">
          <label>공급가능수량</label>
          <input type="number" value={values.available_qty} onChange={(e) => set('available_qty', e.target.value)} />
        </div>
        <div className="form-field">
          <label>리드타임(일)</label>
          <input type="number" value={values.lead_time_days} onChange={(e) => set('lead_time_days', e.target.value)} />
        </div>
        <div className="form-field">
          <label>담당자명</label>
          <input type="text" value={values.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </div>
        <div className="form-field">
          <label>담당자 연락처</label>
          <input type="text" value={values.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        </div>
        <div className="form-field">
          <label>원산지/인증정보</label>
          <input type="text" value={values.origin_and_cert} onChange={(e) => set('origin_and_cert', e.target.value)} />
        </div>
        <div className="form-field">
          <label>유통기한/보관조건</label>
          <input
            type="text"
            value={values.shelf_life_and_storage}
            onChange={(e) => set('shelf_life_and_storage', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>프로모션유형</label>
          <select value={values.promotion_type} onChange={(e) => set('promotion_type', e.target.value)}>
            <option value="">선택 안 함</option>
            {PROMOTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>적용채널</label>
          <input
            type="text"
            placeholder="미입력 시 전체"
            value={values.target_channel}
            onChange={(e) => set('target_channel', e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>첨부링크</label>
          <input type="url" value={values.attachment_url} onChange={(e) => set('attachment_url', e.target.value)} />
        </div>
      </div>
    </details>
  );
}

export function PromotionExtraFieldsView({ promotion }) {
  const entries = Object.entries(EXTRA_FIELD_LABELS).filter(([field]) => promotion?.[field] != null && promotion[field] !== '');
  if (entries.length === 0) return null;

  return (
    <details className="extra-fields">
      <summary>상세 조건</summary>
      <div className="extra-fields-grid">
        {entries.map(([field, label]) => (
          <div className="detail-row" key={field}>
            <span className="detail-label">{label}</span>
            <span>{promotion[field]}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
