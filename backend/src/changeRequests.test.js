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
    body: JSON.stringify({
      role,
      company_name: 'Test Company',
      email,
      password: PASSWORD,
    }),
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

const post = (token, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

const patch = (token, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

test('변경요청 등록 시 pending으로 저장되고, 승인 전 프로모션에 대한 요청은 is_post_approval_change=false', async () => {
  const partner = await signupAndLogin('partner');
  const promotion = await createPromotion(partner.token, { start_date: '2097-02-01', end_date: '2097-02-05' });

  const res = await post(partner.token, `/promotions/${promotion.id}/change-requests`, { content: '가격 조정 요청' });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.apply_status, 'pending');
  assert.strictEqual(body.is_post_approval_change, false);
});

test('승인 이후 변경요청 등록 시 is_post_approval_change=true, 프로모션 status는 approved 유지, CJ프레시웨이만 처리 가능', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2097-03-01', end_date: '2097-03-05' });

  await patch(cj.token, `/promotions/${promotion.id}/approve`);

  const res = await post(partner.token, `/promotions/${promotion.id}/change-requests`, { content: '수량 조정 요청' });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.is_post_approval_change, true);

  const listRes = await fetch(`${baseUrl}/promotions`, {
    headers: { Authorization: `Bearer ${partner.token}` },
  });
  const list = await listRes.json();
  const promotions = Array.isArray(list) ? list : list.items;
  const updated = promotions.find((p) => p.id === promotion.id);
  assert.strictEqual(updated.status, 'approved');

  const partnerAttempt = await patch(partner.token, `/change-requests/${body.id}`, { apply_status: 'applied' });
  assert.strictEqual(partnerAttempt.status, 403);

  const cjRes = await patch(cj.token, `/change-requests/${body.id}`, { apply_status: 'applied' });
  assert.strictEqual(cjRes.status, 200);
  const cjBody = await cjRes.json();
  assert.strictEqual(cjBody.apply_status, 'applied');
});

test('필수값(content) 없이 변경요청 등록 시 400이 반환된다', async () => {
  const partner = await signupAndLogin('partner');
  const promotion = await createPromotion(partner.token, { start_date: '2097-04-01', end_date: '2097-04-05' });

  const res = await post(partner.token, `/promotions/${promotion.id}/change-requests`, {});
  assert.strictEqual(res.status, 400);
});

test('다른 협력사의 프로모션에 변경요청을 등록하려 하면 403이 반환된다(IDOR 방지)', async () => {
  const partnerA = await signupAndLogin('partner');
  const partnerB = await signupAndLogin('partner');
  const promotion = await createPromotion(partnerA.token, { start_date: '2097-05-01', end_date: '2097-05-05' });

  const res = await post(partnerB.token, `/promotions/${promotion.id}/change-requests`, { content: '허용되지 않는 요청' });
  assert.strictEqual(res.status, 403);
});
