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
    body: JSON.stringify({ role, company_name: `Test Company ${crypto.randomUUID()}`, email, password: PASSWORD }),
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
      start_date: '2096-01-01',
      end_date: '2096-01-10',
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

const getNotifications = (token, query = '') =>
  fetch(`${baseUrl}/notifications${query}`, { headers: { Authorization: `Bearer ${token}` } });

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

test('프로모션 등록 시 모든 CJ프레시웨이 계정에 알림이 생성된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  await createPromotion(partner.token);

  const res = await getNotifications(cj.token);
  assert.strictEqual(res.status, 200);
  const notifications = await res.json();
  assert.ok(notifications.some((n) => n.type === 'new_promotion'));
});

test('승인/반려 시 협력사 계정에 알림이 생성된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  const approved = await createPromotion(partner.token, { start_date: '2096-02-01', end_date: '2096-02-05' });
  await patch(cj.token, `/promotions/${approved.id}/approve`);

  const rejected = await createPromotion(partner.token, { start_date: '2096-03-01', end_date: '2096-03-05' });
  await patch(cj.token, `/promotions/${rejected.id}/reject`, { reject_reason: '사유' });

  const res = await getNotifications(partner.token, '?limit=50');
  const notifications = await res.json();
  assert.ok(notifications.some((n) => n.type === 'approved' && n.promotion_id === approved.id));
  assert.ok(notifications.some((n) => n.type === 'rejected' && n.promotion_id === rejected.id));
});

test('알림은 최신순으로 정렬되고 limit 파라미터로 개수가 제한된다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  for (let i = 0; i < 3; i++) {
    await createPromotion(partner.token, { start_date: `2096-0${i + 4}-01`, end_date: `2096-0${i + 4}-05` });
  }

  const res = await getNotifications(cj.token, '?limit=2');
  const notifications = await res.json();
  assert.strictEqual(notifications.length, 2);
  assert.ok(new Date(notifications[0].created_at) >= new Date(notifications[1].created_at));
});

test('인증 없이 알림 조회 시 401이 반환된다', async () => {
  const res = await fetch(`${baseUrl}/notifications`);
  assert.strictEqual(res.status, 401);
});

test('알림은 기본적으로 is_read=false이고, 읽음 처리 API로 개별/전체 처리할 수 있다', async () => {
  // notifyAllCjFreshway는 DB의 모든 cj_freshway 계정에 브로드캐스트하므로, 동시에 실행되는
  // 다른 테스트 파일이 이 cj 계정에도 알림을 추가할 수 있다 — 그래서 전체 개수(unread-count,
  // 목록 length)로 단언하지 않고, 이 테스트가 만든 특정 알림 2건만 id로 추적해서 확인한다.
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  const p1 = await createPromotion(partner.token, { start_date: '2096-08-01', end_date: '2096-08-05' });
  const p2 = await createPromotion(partner.token, { start_date: '2096-09-01', end_date: '2096-09-05' });

  const before = await (await getNotifications(cj.token, '?limit=50')).json();
  const n1 = before.find((n) => n.promotion_id === p1.id);
  const n2 = before.find((n) => n.promotion_id === p2.id);
  assert.strictEqual(n1.is_read, false);
  assert.strictEqual(n2.is_read, false);

  const markOne = await patch(cj.token, `/notifications/${n1.id}/read`);
  assert.strictEqual(markOne.status, 200);

  const afterOne = await (await getNotifications(cj.token, '?limit=50')).json();
  assert.strictEqual(afterOne.find((n) => n.id === n1.id).is_read, true);
  assert.strictEqual(afterOne.find((n) => n.id === n2.id).is_read, false);

  const markAll = await patch(cj.token, '/notifications/read-all');
  assert.strictEqual(markAll.status, 200);

  const afterAll = await (await getNotifications(cj.token, '?limit=50')).json();
  assert.strictEqual(afterAll.find((n) => n.id === n1.id).is_read, true);
  assert.strictEqual(afterAll.find((n) => n.id === n2.id).is_read, true);

  const unreadCountRes = await fetch(`${baseUrl}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${cj.token}` },
  });
  assert.strictEqual(unreadCountRes.status, 200);
  const unreadCount = await unreadCountRes.json();
  assert.strictEqual(typeof unreadCount.count, 'number');
});

test('타 사용자에게 온 알림은 조회되지 않는다', async () => {
  const partnerA = await signupAndLogin('partner');
  const partnerB = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  const promotion = await createPromotion(partnerA.token, { start_date: '2096-07-01', end_date: '2096-07-05' });
  await patch(cj.token, `/promotions/${promotion.id}/approve`);

  const res = await getNotifications(partnerB.token, '?limit=50');
  const notifications = await res.json();
  assert.ok(!notifications.some((n) => n.promotion_id === promotion.id));
});
