const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

let server;
let baseUrl;

const PASSWORD = 'password123!';
const uniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;

const signupAndLogin = async (role) => {
  const email = uniqueEmail();
  await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, company_name: 'Test Company', email, password: PASSWORD }),
  });
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await loginRes.json();
  return { token: body.access_token };
};

const createPromotion = (token, overrides = {}) =>
  fetch(`${baseUrl}/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      start_date: '2095-08-01',
      end_date: '2095-08-10',
      condition: '10% 할인',
      items: [{ name: '테스트품목' }],
      ...overrides,
    }),
  });

before(async () => {
  const app = require('./app');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('등록 시 선택 필드(할인유형/부담율/MOQ 등)를 함께 저장하고 그대로 반환한다', async () => {
  const partner = await signupAndLogin('partner');

  const res = await createPromotion(partner.token, {
    discount_type: '정률할인',
    discount_value: 15,
    partner_cost_share_pct: 60,
    moq: 100,
    available_qty: 5000,
    lead_time_days: 3,
    contact_name: '홍길동',
    contact_phone: '010-1234-5678',
    origin_and_cert: '국내산, HACCP 인증',
    shelf_life_and_storage: '제조일로부터 12개월, 냉장 보관',
    promotion_type: '신제품출시',
    target_channel: '단체급식',
    attachment_url: 'https://example.com/spec.pdf',
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.discount_type, '정률할인');
  assert.strictEqual(Number(body.discount_value), 15);
  assert.strictEqual(Number(body.partner_cost_share_pct), 60);
  assert.strictEqual(body.moq, 100);
  assert.strictEqual(body.available_qty, 5000);
  assert.strictEqual(body.lead_time_days, 3);
  assert.strictEqual(body.contact_name, '홍길동');
  assert.strictEqual(body.contact_phone, '010-1234-5678');
  assert.strictEqual(body.origin_and_cert, '국내산, HACCP 인증');
  assert.strictEqual(body.shelf_life_and_storage, '제조일로부터 12개월, 냉장 보관');
  assert.strictEqual(body.promotion_type, '신제품출시');
  assert.strictEqual(body.target_channel, '단체급식');
  assert.strictEqual(body.attachment_url, 'https://example.com/spec.pdf');
});

test('선택 필드를 전혀 입력하지 않아도 정상 등록된다(전부 선택 입력)', async () => {
  const partner = await signupAndLogin('partner');
  const res = await createPromotion(partner.token);
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.discount_type, null);
  assert.strictEqual(body.moq, null);
});

test('잘못된 할인유형/프로모션유형/부담율은 400을 반환한다', async () => {
  const partner = await signupAndLogin('partner');

  const badDiscount = await createPromotion(partner.token, { discount_type: '없는유형' });
  assert.strictEqual(badDiscount.status, 400);

  const badPromoType = await createPromotion(partner.token, { promotion_type: '없는유형' });
  assert.strictEqual(badPromoType.status, 400);

  const badPct = await createPromotion(partner.token, { partner_cost_share_pct: 150 });
  assert.strictEqual(badPct.status, 400);
});

test('음수/비정상 숫자 실무필드는 400을 반환한다', async () => {
  const partner = await signupAndLogin('partner');

  const negativeMoq = await createPromotion(partner.token, { moq: -10 });
  assert.strictEqual(negativeMoq.status, 400);

  const negativeQty = await createPromotion(partner.token, { available_qty: -1 });
  assert.strictEqual(negativeQty.status, 400);

  const negativeLeadTime = await createPromotion(partner.token, { lead_time_days: -3 });
  assert.strictEqual(negativeLeadTime.status, 400);

  const negativeDiscount = await createPromotion(partner.token, { discount_value: -5 });
  assert.strictEqual(negativeDiscount.status, 400);

  const validZero = await createPromotion(partner.token, { moq: 0 });
  assert.strictEqual(validZero.status, 201);
});

test('정수 컬럼(moq/available_qty/lead_time_days)에 소수나 int4 범위 초과값을 보내면 400을 반환한다(DB 500 대신)', async () => {
  const partner = await signupAndLogin('partner');

  const decimalMoq = await createPromotion(partner.token, { moq: 0.5 });
  assert.strictEqual(decimalMoq.status, 400);

  const overflowQty = await createPromotion(partner.token, { available_qty: 1e10 });
  assert.strictEqual(overflowQty.status, 400);
});

test('종료일이 시작일보다 이전이면 400을 반환한다(DB 500 대신)', async () => {
  const partner = await signupAndLogin('partner');

  const res = await createPromotion(partner.token, { start_date: '2095-08-10', end_date: '2095-08-01' });
  assert.strictEqual(res.status, 400);
});

test('품목명이 빈 문자열이면 400, 품목이 51개 이상이면 400을 반환한다', async () => {
  const partner = await signupAndLogin('partner');

  const emptyName = await createPromotion(partner.token, { items: [{ name: '' }] });
  assert.strictEqual(emptyName.status, 400);

  const tooMany = await createPromotion(partner.token, {
    items: Array.from({ length: 51 }, (_, i) => ({ name: `품목${i}` })),
  });
  assert.strictEqual(tooMany.status, 400);
});

test('실무필드 문자열 길이 제한(contact_name 등)을 초과하면 400을 반환한다(DB 500 대신)', async () => {
  const partner = await signupAndLogin('partner');

  const res = await createPromotion(partner.token, { contact_name: 'a'.repeat(101) });
  assert.strictEqual(res.status, 400);
});

test('첨부링크가 http(s)로 시작하지 않으면 400을 반환한다', async () => {
  const partner = await signupAndLogin('partner');

  const badUrl = await createPromotion(partner.token, { attachment_url: 'javascript:alert(1)' });
  assert.strictEqual(badUrl.status, 400);

  const okUrl = await createPromotion(partner.token, { attachment_url: 'https://example.com/spec.pdf' });
  assert.strictEqual(okUrl.status, 201);
});

test('CJ프레시웨이가 "수정 후 승인" 시 선택 필드를 함께 수정할 수 있다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const created = await (await createPromotion(partner.token, { moq: 10 })).json();

  const res = await fetch(`${baseUrl}/promotions/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cj.token}` },
    body: JSON.stringify({ moq: 500, contact_name: '수정된담당자' }),
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'approved');
  assert.strictEqual(body.moq, 500);
  assert.strictEqual(body.contact_name, '수정된담당자');
});

test('반려 후 재제출 시 선택 필드를 함께 수정할 수 있다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const created = await (await createPromotion(partner.token, { moq: 10 })).json();

  await fetch(`${baseUrl}/promotions/${created.id}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cj.token}` },
    body: JSON.stringify({ reject_reason: '사유' }),
  });

  const res = await fetch(`${baseUrl}/promotions/${created.id}/resubmit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partner.token}` },
    body: JSON.stringify({
      start_date: '2095-09-01',
      end_date: '2095-09-05',
      condition: '수정된 조건',
      items: [{ name: '품목' }],
      moq: 999,
    }),
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'proposed');
  assert.strictEqual(body.moq, 999);
});
