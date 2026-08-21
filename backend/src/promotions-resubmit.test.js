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
  return { token: body.access_token, userId: body.user?.id ?? body.id };
};

const createPromotion = async (token, overrides = {}) => {
  const res = await fetch(`${baseUrl}/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      start_date: '2097-01-01',
      end_date: '2097-01-10',
      condition: '10% 할인',
      items: [{ name: '테스트품목' }],
      ...overrides,
    }),
  });
  return res.json();
};

const patch = (token, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
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

test('반려된 프로모션을 수정 후 재제출하면 proposed로 전이되고 반려사유가 지워진다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2097-02-01', end_date: '2097-02-05' });

  await patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '조건 불충분' });

  const res = await patch(partner.token, `/promotions/${promotion.id}/resubmit`, {
    start_date: '2097-02-10',
    end_date: '2097-02-15',
    condition: '수정된 조건',
    items: [{ name: '수정된품목' }],
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'proposed');
  assert.strictEqual(body.reject_reason, null);
  assert.strictEqual(body.condition, '수정된 조건');
  assert.strictEqual(body.items.length, 1);
  assert.strictEqual(body.items[0].name, '수정된품목');
});

test('재제출 시 필수값이 없으면 400, 다른 협력사가 시도하면 403, rejected가 아니면 409가 반환된다', async () => {
  const partner = await signupAndLogin('partner');
  const otherPartner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2097-03-01', end_date: '2097-03-05' });

  await patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '사유' });

  const missingFieldsRes = await patch(partner.token, `/promotions/${promotion.id}/resubmit`, {
    start_date: '2097-03-10',
    end_date: '2097-03-15',
    condition: '조건',
    items: [],
  });
  assert.strictEqual(missingFieldsRes.status, 400);

  const otherPartnerRes = await patch(otherPartner.token, `/promotions/${promotion.id}/resubmit`, {
    start_date: '2097-03-10',
    end_date: '2097-03-15',
    condition: '조건',
    items: [{ name: '품목' }],
  });
  assert.strictEqual(otherPartnerRes.status, 403);

  const promotion2 = await createPromotion(partner.token, { start_date: '2097-04-01', end_date: '2097-04-05' });
  const notRejectedRes = await patch(partner.token, `/promotions/${promotion2.id}/resubmit`, {
    start_date: '2097-04-10',
    end_date: '2097-04-15',
    condition: '조건',
    items: [{ name: '품목' }],
  });
  assert.strictEqual(notRejectedRes.status, 409);
});

test('CJ프레시웨이 계정으로 재제출을 시도하면 403이 반환된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2097-05-01', end_date: '2097-05-05' });
  await patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '사유' });

  const res = await patch(cj.token, `/promotions/${promotion.id}/resubmit`, {
    start_date: '2097-05-10',
    end_date: '2097-05-15',
    condition: '조건',
    items: [{ name: '품목' }],
  });
  assert.strictEqual(res.status, 403);
});
