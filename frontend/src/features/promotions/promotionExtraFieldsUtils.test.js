import { test } from 'node:test';
import assert from 'node:assert';
import { extraFieldsFromPromotion, extraFieldsToPayload, EXTRA_FIELDS_INITIAL } from './promotionExtraFieldsUtils.js';

test('extraFieldsToPayload: 빈 문자열/undefined는 null로 변환된다', () => {
  const payload = extraFieldsToPayload(EXTRA_FIELDS_INITIAL);
  assert.strictEqual(payload.discount_type, null);
  assert.strictEqual(payload.moq, null);
  assert.strictEqual(payload.attachment_url, null);
});

test('extraFieldsToPayload: 숫자 필드는 Number로, 그 외는 그대로 전달된다', () => {
  const payload = extraFieldsToPayload({
    ...EXTRA_FIELDS_INITIAL,
    discount_value: '15',
    moq: '100',
    contact_name: '홍길동',
  });
  assert.strictEqual(payload.discount_value, 15);
  assert.strictEqual(typeof payload.discount_value, 'number');
  assert.strictEqual(payload.moq, 100);
  assert.strictEqual(payload.contact_name, '홍길동');
});

test('extraFieldsFromPromotion: 프로모션에 없는 필드는 빈 문자열로 채워진다', () => {
  const result = extraFieldsFromPromotion({ moq: 50, contact_name: null });
  assert.strictEqual(result.moq, 50);
  assert.strictEqual(result.contact_name, '');
  assert.strictEqual(result.discount_type, '');
});

test('extraFieldsFromPromotion(undefined): 프로모션이 없어도 예외 없이 전부 빈 문자열을 반환한다', () => {
  const result = extraFieldsFromPromotion(undefined);
  assert.deepStrictEqual(result, EXTRA_FIELDS_INITIAL);
});
