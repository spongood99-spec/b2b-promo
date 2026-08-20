const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// docs/4-user-scenario.md 시나리오 1~6을 API 호출 흐름 그대로 재현하는 E2E 테스트.
// 시나리오 3의 "반려됨 → 제안됨" 재제안 구간은 구현된 API가 없어(9-plan.md BE-7 참고) 제외한다.

let server;
let baseUrl;

const PASSWORD = 'password123!';
const uniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;
const uniqueCompany = (label) => `${label} ${crypto.randomUUID()}`;

const signupAndLogin = async (role, companyName) => {
  const email = uniqueEmail();
  const signupRes = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, company_name: companyName, email, password: PASSWORD }),
  });
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await loginRes.json();
  return { signupStatus: signupRes.status, loginStatus: loginRes.status, token: body.access_token, user: body.user };
};

const authed = (token, method, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

test('시나리오 1: 협력사 담당자의 프로모션 제안 등록', async () => {
  const company = uniqueCompany('시나리오1 협력사');
  const partner = await signupAndLogin('partner', company);
  assert.strictEqual(partner.loginStatus, 200);
  assert.ok(partner.token, 'access token이 발급되어야 한다');

  const res = await authed(partner.token, 'POST', '/promotions', {
    start_date: '2095-01-01',
    end_date: '2095-01-10',
    condition: '10% 할인',
    items: [{ name: `시나리오1품목-${crypto.randomUUID()}` }],
  });
  assert.strictEqual(res.status, 201);
  const promotion = await res.json();
  assert.strictEqual(promotion.status, 'proposed');
  assert.strictEqual(promotion.items.length, 1);

  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));
  const listRes = await authed(cj.token, 'GET', '/promotions');
  const list = await listRes.json();
  const promotions = Array.isArray(list) ? list : list.items;
  assert.ok(promotions.some((p) => p.id === promotion.id), 'CJ프레시웨이 목록에 노출되어야 한다');
});

test('시나리오 2: CJ프레시웨이 담당자의 프로모션 승인', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오2 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-02-01',
      end_date: '2095-02-10',
      condition: '10% 할인',
      items: [{ name: `시나리오2품목-${crypto.randomUUID()}` }],
    })
  ).json();

  const approveRes = await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);
  assert.strictEqual(approveRes.status, 200);
  const approved = await approveRes.json();
  assert.strictEqual(approved.status, 'approved');
  assert.strictEqual(approved.reviewer_id, cj.user.id);
});

test('시나리오 3: CJ프레시웨이 담당자의 프로모션 반려 (사유 필수)', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오3 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-03-01',
      end_date: '2095-03-10',
      condition: '10% 할인',
      items: [{ name: `시나리오3품목-${crypto.randomUUID()}` }],
    })
  ).json();

  const withoutReason = await authed(cj.token, 'PATCH', `/promotions/${created.id}/reject`, {});
  assert.strictEqual(withoutReason.status, 400, '반려사유 없이는 처리되지 않아야 한다');

  const rejectRes = await authed(cj.token, 'PATCH', `/promotions/${created.id}/reject`, {
    reject_reason: '조건이 부적절함',
  });
  assert.strictEqual(rejectRes.status, 200);
  const rejected = await rejectRes.json();
  assert.strictEqual(rejected.status, 'rejected');
  assert.strictEqual(rejected.reject_reason, '조건이 부적절함');
});

test('시나리오 4: 변경요청 등록(승인후변경 EC-03) 및 반영', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오4 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-04-01',
      end_date: '2095-04-10',
      condition: '10% 할인',
      items: [{ name: `시나리오4품목-${crypto.randomUUID()}` }],
    })
  ).json();
  await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);

  const crRes = await authed(partner.token, 'POST', `/promotions/${created.id}/change-requests`, {
    content: '기간을 1주일 연장 요청',
  });
  assert.strictEqual(crRes.status, 201);
  const changeRequest = await crRes.json();
  assert.strictEqual(changeRequest.apply_status, 'pending');
  assert.strictEqual(changeRequest.is_post_approval_change, true, '승인됨 상태 이후 요청이므로 EC-03 적용');

  const stillApproved = await (await authed(cj.token, 'GET', `/promotions/${created.id}`)).json();
  assert.strictEqual(stillApproved.status, 'approved', '변경요청 등록만으로는 검토중으로 되돌아가지 않는다');

  const applyRes = await authed(cj.token, 'PATCH', `/change-requests/${changeRequest.id}`, { apply_status: 'applied' });
  assert.strictEqual(applyRes.status, 200);
  const applied = await applyRes.json();
  assert.strictEqual(applied.apply_status, 'applied');
});

test('시나리오 5: CJ프레시웨이 담당자의 프로모션 취소 및 재오픈(P1)', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오5 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-05-01',
      end_date: '2095-05-10',
      condition: '10% 할인',
      items: [{ name: `시나리오5품목-${crypto.randomUUID()}` }],
    })
  ).json();
  await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);

  const withoutReason = await authed(cj.token, 'PATCH', `/promotions/${created.id}/cancel`, {});
  assert.strictEqual(withoutReason.status, 400, '취소사유 없이는 처리되지 않아야 한다');

  const cancelRes = await authed(cj.token, 'PATCH', `/promotions/${created.id}/cancel`, {
    cancel_reason: '공급사 사정으로 진행 불가',
  });
  assert.strictEqual(cancelRes.status, 200);
  const cancelled = await cancelRes.json();
  assert.strictEqual(cancelled.status, 'cancelled');

  const reopenRes = await authed(cj.token, 'PATCH', `/promotions/${created.id}/reopen`);
  assert.strictEqual(reopenRes.status, 200);
  const reopened = await reopenRes.json();
  assert.strictEqual(reopened.status, 'in_review');
});

test('시나리오 6: 캘린더에서 기간과 겹치는 프로모션 조회 및 상세 확인', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오6 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-06-10',
      end_date: '2095-06-20',
      condition: '10% 할인',
      items: [{ name: `시나리오6품목-${crypto.randomUUID()}` }],
    })
  ).json();

  const calendarRes = await authed(cj.token, 'GET', '/promotions?from=2095-06-01&to=2095-06-30');
  const calendarList = await calendarRes.json();
  const calendarPromotions = Array.isArray(calendarList) ? calendarList : calendarList.items;
  assert.ok(calendarPromotions.some((p) => p.id === created.id), '조회 월과 겹치는 프로모션이 표시되어야 한다');

  const outOfRangeRes = await authed(cj.token, 'GET', '/promotions?from=2095-07-01&to=2095-07-31');
  const outOfRangeList = await outOfRangeRes.json();
  const outOfRangePromotions = Array.isArray(outOfRangeList) ? outOfRangeList : outOfRangeList.items;
  assert.ok(!outOfRangePromotions.some((p) => p.id === created.id), '겹치지 않는 기간에는 표시되지 않아야 한다');

  const detailRes = await authed(cj.token, 'GET', `/promotions/${created.id}`);
  assert.strictEqual(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.strictEqual(detail.condition, '10% 할인');
});
