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

  // ponytail: 목록은 이제 페이지네이션되므로(개발 DB에 누적된 다른 테스트 데이터에 밀려날 수 있음),
  // 두 프로모션의 실제 기간(2099-02~03)으로 범위 조회(from/to, 캘린더용 — 페이징 없음)해 확실히 잡아낸다.
  const listA = await (await getPromotions(tokenA, '?from=2099-02-01&to=2099-02-28')).json();
  assert.ok(listA.some((p) => p.id === bodyA.id));
  assert.ok(!listA.some((p) => p.id === bodyB.id));

  const listCj = await (await getPromotions(tokenCj, '?from=2099-02-01&to=2099-03-05')).json();
  assert.ok(listCj.some((p) => p.id === bodyA.id));
  assert.ok(listCj.some((p) => p.id === bodyB.id));
});

test('일반 목록 조회(from/to 없음)는 페이지네이션되어 items/total/page/limit을 반환한다', async () => {
  const token = await signupAndLogin('partner');

  for (let i = 0; i < 3; i++) {
    await createPromotion(token, {
      start_date: `2098-0${i + 1}-01`,
      end_date: `2098-0${i + 1}-10`,
      condition: `페이지네이션 조건 ${i}`,
      items: [{ name: `페이지네이션품목${i}` }],
    });
  }

  const page1 = await (await getPromotions(token, '?limit=2&page=1')).json();
  assert.strictEqual(page1.items.length, 2);
  assert.strictEqual(page1.total, 3);
  assert.strictEqual(page1.page, 1);
  assert.strictEqual(page1.limit, 2);

  const page2 = await (await getPromotions(token, '?limit=2&page=2')).json();
  assert.strictEqual(page2.items.length, 1);
  assert.strictEqual(page2.total, 3);

  const page1Ids = new Set(page1.items.map((p) => p.id));
  assert.ok(!page2.items.some((p) => page1Ids.has(p.id)), '페이지 간 항목이 중복되지 않아야 한다');
});

test('q 파라미터로 조건 텍스트/품목명/제안자 소속사명을 검색할 수 있다', async () => {
  const token = await signupAndLogin('partner');

  await createPromotion(token, {
    start_date: '2098-06-01',
    end_date: '2098-06-10',
    condition: '검색용특이조건XYZ',
    items: [{ name: '평범한품목' }],
  });
  await createPromotion(token, {
    start_date: '2098-07-01',
    end_date: '2098-07-10',
    condition: '평범한조건',
    items: [{ name: '검색용특이품목XYZ' }],
  });
  await createPromotion(token, {
    start_date: '2098-08-01',
    end_date: '2098-08-10',
    condition: '전혀관련없음',
    items: [{ name: '무관품목' }],
  });

  const byCondition = await (await getPromotions(token, '?q=특이조건XYZ')).json();
  assert.strictEqual(byCondition.total, 1);

  const byItem = await (await getPromotions(token, '?q=특이품목XYZ')).json();
  assert.strictEqual(byItem.total, 1);

  const byCompany = await (await getPromotions(token, `?q=${encodeURIComponent('Test Company')}`)).json();
  assert.strictEqual(byCompany.total, 3);

  const noMatch = await (await getPromotions(token, '?q=존재하지않는검색어QQQ')).json();
  assert.strictEqual(noMatch.total, 0);
});

test('GET /promotions/stats는 역할별 범위로 상태별 건수를 반환한다', async () => {
  const tokenA = await signupAndLogin('partner');
  const tokenB = await signupAndLogin('partner');
  const tokenCj = await signupAndLogin('cj_freshway');

  const promoPayload = (start, end) => ({
    start_date: start,
    end_date: end,
    condition: '조건',
    items: [{ name: '품목' }],
  });

  await createPromotion(tokenA, promoPayload('2098-09-01', '2098-09-05'));
  await createPromotion(tokenA, promoPayload('2098-09-10', '2098-09-15'));
  await createPromotion(tokenB, promoPayload('2098-09-20', '2098-09-25'));

  const statsA = await (await fetch(`${baseUrl}/promotions/stats`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  assert.strictEqual(statsA.proposed, 2);
  assert.strictEqual(statsA.approved, undefined);

  const statsCj = await (await fetch(`${baseUrl}/promotions/stats`, {
    headers: { Authorization: `Bearer ${tokenCj}` },
  })).json();
  assert.ok(statsCj.proposed >= 3, '협력사 범위와 무관하게 전체 합계를 봐야 한다');
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
