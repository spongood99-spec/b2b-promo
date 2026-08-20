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
  return body.access_token;
};

const createPromotion = (token, payload) =>
  fetch(`${baseUrl}/promotions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

const getPromotions = (token, query = '') =>
  fetch(`${baseUrl}/promotions${query}`, {
    headers: { Authorization: `Bearer ${token}` },
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

test('협력사 계정으로 등록 시 status가 proposed로 생성되고 items가 응답에 포함된다', async () => {
  const token = await signupAndLogin('partner');

  const res = await createPromotion(token, {
    start_date: '2099-01-01',
    end_date: '2099-01-10',
    condition: '10% 할인',
    items: [{ name: '테스트품목A' }],
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.status, 'proposed');
  assert.strictEqual(body.items.length, 1);
});

test('필수값(기간/대상 품목/조건) 누락 시 400과 오류 메시지가 반환된다', async () => {
  const token = await signupAndLogin('partner');

  const res = await createPromotion(token, {
    start_date: '2099-01-01',
    end_date: '2099-01-10',
    condition: '10% 할인',
    items: [],
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(typeof body.error.code, 'string');
  assert.strictEqual(typeof body.error.message, 'string');
});

test('협력사 계정 조회 시 본인이 등록한 프로모션만, CJ프레시웨이 계정 조회 시 전체가 반환된다', async () => {
  const tokenA = await signupAndLogin('partner');
  const tokenB = await signupAndLogin('partner');
  const tokenCj = await signupAndLogin('cj_freshway');

  const resA = await createPromotion(tokenA, {
    start_date: '2099-02-01',
    end_date: '2099-02-05',
    condition: 'A 조건',
    items: [{ name: 'A품목' }],
  });
  const bodyA = await resA.json();

  const resB = await createPromotion(tokenB, {
    start_date: '2099-03-01',
    end_date: '2099-03-05',
    condition: 'B 조건',
    items: [{ name: 'B품목' }],
  });
  const bodyB = await resB.json();

  const listA = await (await getPromotions(tokenA)).json();
  assert.ok(listA.some((p) => p.id === bodyA.id));
  assert.ok(!listA.some((p) => p.id === bodyB.id));

  const listCj = await (await getPromotions(tokenCj)).json();
  assert.ok(listCj.some((p) => p.id === bodyA.id));
  assert.ok(listCj.some((p) => p.id === bodyB.id));
});

test('CJ프레시웨이 계정으로 등록 시도 시 403이 반환된다', async () => {
  const token = await signupAndLogin('cj_freshway');

  const res = await createPromotion(token, {
    start_date: '2099-04-01',
    end_date: '2099-04-10',
    condition: '조건',
    items: [{ name: '품목' }],
  });

  assert.strictEqual(res.status, 403);
});

test('기간(from/to) 조회로 특정 기간과 겹치는 프로모션만 반환된다', async () => {
  const tokenPartner = await signupAndLogin('partner');
  const tokenCj = await signupAndLogin('cj_freshway');

  const resOverlap = await createPromotion(tokenPartner, {
    start_date: '2099-05-01',
    end_date: '2099-05-10',
    condition: '겹침 조건',
    items: [{ name: '겹침품목' }],
  });
  const bodyOverlap = await resOverlap.json();

  const resNonOverlap = await createPromotion(tokenPartner, {
    start_date: '2099-06-01',
    end_date: '2099-06-10',
    condition: '안겹침 조건',
    items: [{ name: '안겹침품목' }],
  });
  const bodyNonOverlap = await resNonOverlap.json();

  const list = await (
    await getPromotions(tokenCj, '?from=2099-05-05&to=2099-05-15')
  ).json();

  assert.ok(list.some((p) => p.id === bodyOverlap.id));
  assert.ok(!list.some((p) => p.id === bodyNonOverlap.id));
});
