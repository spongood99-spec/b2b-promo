// PromotionExtraFields.jsx의 JSX 없는 순수 로직만 분리한 파일.
// node:test로 번들러 없이 바로 테스트하기 위한 목적 하나뿐이니, JSX가 필요해지면 다시 합치지 않는다.

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
