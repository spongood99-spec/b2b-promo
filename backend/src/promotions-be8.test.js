const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { canReopen } = require('./services/promotions.service');

let server;
let baseUrl;

const PASSWORD = 'password123!';
const uniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;

const signupAndLogin = async (role, companyName = 'Test Company') => {
  const email = uniqueEmail();
  await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      company_name: companyName,
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
      start_date: '2096-01-01',
      end_date: '2096-01-10',
      condition: '10% 할인',
      items: [{ name: '테스트품목' }],
      ...overrides,
    }),
  });
  return { res, body: await res.json() };
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

test('canReopen: closed/cancelled만 true, 나머지는 false', () => {
  assert.strictEqual(canReopen('closed'), true);
  assert.strictEqual(canReopen('cancelled'), true);
  assert.strictEqual(canReopen('proposed'), false);
  assert.strictEqual(canReopen('in_review'), false);
  assert.strictEqual(canReopen('approved'), false);
  assert.strictEqual(canReopen('rejected'), false);
  assert.strictEqual(canReopen('active'), false);
});

test('재오픈 - cancelled 상태에서 성공 시 200, status는 in_review', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const { body: promotion } = await createPromotion(partner.token, {
    start_date: '2096-02-01',
    end_date: '2096-02-05',
  });

  await patch(cj.token, `/promotions/${promotion.id}/approve`);
  await patch(cj.token, `/promotions/${promotion.id}/cancel`, { cancel_reason: '테스트 취소' });

  const res = await patch(cj.token, `/promotions/${promotion.id}/reopen`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'in_review');
});

test('재오픈 - closed 상태에서 성공 시 200, status는 in_review', async () => {
  const pool = require('./db/pool');
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const { body: promotion } = await createPromotion(partner.token, {
    start_date: '2096-03-01',
    end_date: '2096-03-05',
  });

  await pool.query("UPDATE promotions SET status='closed' WHERE id=$1", [promotion.id]);

  const res = await patch(cj.token, `/promotions/${promotion.id}/reopen`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'in_review');
});

test('재오픈 - 그 외 상태(proposed)에서는 409', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const { body: promotion } = await createPromotion(partner.token, {
    start_date: '2096-04-01',
    end_date: '2096-04-05',
  });

  const res = await patch(cj.token, `/promotions/${promotion.id}/reopen`);
  assert.strictEqual(res.status, 409);
});

test('재오픈 - 협력사 계정으로 시도 시 403', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');
  const { body: promotion } = await createPromotion(partner.token, {
    start_date: '2096-05-20',
    end_date: '2096-05-25',
  });

  await patch(cj.token, `/promotions/${promotion.id}/approve`);
  await patch(cj.token, `/promotions/${promotion.id}/cancel`, { cancel_reason: '테스트 취소' });

  const res = await patch(partner.token, `/promotions/${promotion.id}/reopen`);
  assert.strictEqual(res.status, 403);
});

test('기간 중복 경고 - 동일 회사·동일 품목·기간 겹침 시 overlap_warning true', async () => {
  const uniqueSuffix = crypto.randomUUID();
  const companyName = `Company X ${uniqueSuffix}`;
  const itemName = `테스트품목B8 ${uniqueSuffix}`;
  const partnerA = await signupAndLogin('partner', companyName);

  await createPromotion(partnerA.token, {
    start_date: '2096-05-01',
    end_date: '2096-05-10',
    items: [{ name: itemName }],
  });

  const { res, body } = await createPromotion(partnerA.token, {
    start_date: '2096-05-05',
    end_date: '2096-05-15',
    items: [{ name: itemName }],
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.overlap_warning, true);
});

test('기간 중복 경고 - 겹치는 기존 프로모션 없으면 overlap_warning false', async () => {
  const uniqueSuffix = crypto.randomUUID();
  const partnerB = await signupAndLogin('partner', `Company Y ${uniqueSuffix}`);

  const { res, body } = await createPromotion(partnerB.token, {
    start_date: '2096-07-01',
    end_date: '2096-07-10',
    items: [{ name: `테스트품목B8-없음 ${uniqueSuffix}` }],
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.overlap_warning, false);
});

test('기간 중복 경고 - 동일 회사·다른 품목이면 겹쳐도 overlap_warning false(AND 조건)', async () => {
  const uniqueSuffix = crypto.randomUUID();
  const companyName = `Company AND-1 ${uniqueSuffix}`;
  const partner = await signupAndLogin('partner', companyName);

  await createPromotion(partner.token, {
    start_date: '2096-08-01',
    end_date: '2096-08-10',
    items: [{ name: `품목A ${uniqueSuffix}` }],
  });

  const { res, body } = await createPromotion(partner.token, {
    start_date: '2096-08-05',
    end_date: '2096-08-15',
    items: [{ name: `품목B ${uniqueSuffix}` }],
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.overlap_warning, false);
});

test('기간 중복 경고 - 다른 회사·동일 품목이면 겹쳐도 overlap_warning false(AND 조건)', async () => {
  const uniqueSuffix = crypto.randomUUID();
  const itemName = `공용품목 ${uniqueSuffix}`;
  const partnerA = await signupAndLogin('partner', `Company AND-2A ${uniqueSuffix}`);
  const partnerB = await signupAndLogin('partner', `Company AND-2B ${uniqueSuffix}`);

  await createPromotion(partnerA.token, {
    start_date: '2096-09-01',
    end_date: '2096-09-10',
    items: [{ name: itemName }],
  });

  const { res, body } = await createPromotion(partnerB.token, {
    start_date: '2096-09-05',
    end_date: '2096-09-15',
    items: [{ name: itemName }],
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.overlap_warning, false);
});

test('기간 중복 경고 - 승인 시점에도 동일 회사·동일 품목·기간 겹침이면 overlap_warning true', async () => {
  const uniqueSuffix = crypto.randomUUID();
  const companyName = `Company Approve-Overlap ${uniqueSuffix}`;
  const itemName = `승인시점품목 ${uniqueSuffix}`;
  const partner = await signupAndLogin('partner', companyName);
  const cj = await signupAndLogin('cj_freshway');

  await createPromotion(partner.token, {
    start_date: '2096-10-01',
    end_date: '2096-10-10',
    items: [{ name: itemName }],
  });

  const { body: promotionToApprove } = await createPromotion(partner.token, {
    start_date: '2096-10-05',
    end_date: '2096-10-15',
    items: [{ name: itemName }],
  });

  const approveRes = await patch(cj.token, `/promotions/${promotionToApprove.id}/approve`);
  assert.strictEqual(approveRes.status, 200);
  const approveBody = await approveRes.json();
  assert.strictEqual(approveBody.overlap_warning, true);
});
