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
      start_date: '2098-01-01',
      end_date: '2098-01-10',
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

test('승인 성공 시 status가 approved로 바뀌고 reviewer_id가 채워진다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token);

  const res = await patch(cj.token, `/promotions/${promotion.id}/approve`);

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'approved');
  assert.strictEqual(body.reviewer_id, cj.userId);
});

test('반려사유 없이 반려 요청 시 400, 사유를 넣으면 rejected로 전이된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2098-02-01', end_date: '2098-02-05' });

  const noReasonRes = await patch(cj.token, `/promotions/${promotion.id}/reject`, {});
  assert.strictEqual(noReasonRes.status, 400);

  const res = await patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '조건 불충분' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'rejected');
  assert.strictEqual(body.reject_reason, '조건 불충분');
});

test('취소사유 없이 취소 요청 시 400, 사유를 넣으면 cancelled로 전이된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2098-03-01', end_date: '2098-03-05' });

  await patch(cj.token, `/promotions/${promotion.id}/approve`);

  const noReasonRes = await patch(cj.token, `/promotions/${promotion.id}/cancel`, {});
  assert.strictEqual(noReasonRes.status, 400);

  const res = await patch(cj.token, `/promotions/${promotion.id}/cancel`, { cancel_reason: '공급 이슈' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'cancelled');
  assert.strictEqual(body.cancel_reason, '공급 이슈');
});

test('협력사 계정으로 승인/반려/취소/수정 호출 시 403이 반환된다', async () => {
  const partner = await signupAndLogin('partner');
  const otherPartner = await signupAndLogin('partner');
  const promotion = await createPromotion(partner.token, { start_date: '2098-04-01', end_date: '2098-04-05' });

  const approveRes = await patch(otherPartner.token, `/promotions/${promotion.id}/approve`);
  assert.strictEqual(approveRes.status, 403);

  const rejectRes = await patch(otherPartner.token, `/promotions/${promotion.id}/reject`, { reject_reason: '사유' });
  assert.strictEqual(rejectRes.status, 403);

  const cancelRes = await patch(otherPartner.token, `/promotions/${promotion.id}/cancel`, { cancel_reason: '사유' });
  assert.strictEqual(cancelRes.status, 403);

  const updateRes = await patch(otherPartner.token, `/promotions/${promotion.id}`, { condition: 'x' });
  assert.strictEqual(updateRes.status, 403);
});

test('허용되지 않은 상태 전이 요청 시 409가 반환된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2098-05-01', end_date: '2098-05-05' });

  await patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '사유' });

  const res = await patch(cj.token, `/promotions/${promotion.id}/approve`);
  assert.strictEqual(res.status, 409);
  const body = await res.json();
  assert.ok(body.error);
});

test('동시에 승인/반려 요청이 들어오면 한 쪽만 성공하고 나머지는 409가 반환된다(레이스 컨디션 가드)', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const promotion = await createPromotion(partner.token, { start_date: '2098-06-01', end_date: '2098-06-05' });

  const [approveRes, rejectRes] = await Promise.all([
    patch(cj.token, `/promotions/${promotion.id}/approve`),
    patch(cj.token, `/promotions/${promotion.id}/reject`, { reject_reason: '사유' }),
  ]);

  const statuses = [approveRes.status, rejectRes.status].sort();
  assert.deepStrictEqual(statuses, [200, 409]);

  const finalRes = await fetch(`${baseUrl}/promotions/${promotion.id}`, {
    headers: { Authorization: `Bearer ${cj.token}` },
  });
  const final = await finalRes.json();
  assert.ok(['approved', 'rejected'].includes(final.status), '승인/반려 중 정확히 하나만 반영되어야 한다');
});
