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
  // ponytail: 목록은 이제 페이지네이션되므로 개발 DB에 누적된 다른 데이터에 밀려날 수 있어,
  // 방금 등록한 프로모션의 실제 기간으로 범위 조회(from/to, 캘린더용 — 페이징 없음)해 확실히 잡아낸다.
  const listRes = await authed(cj.token, 'GET', '/promotions?from=2095-01-01&to=2095-01-10');
  const list = await listRes.json();
  const promotions = Array.isArray(list) ? list : list.items;
  assert.ok(promotions.some((p) => p.id === promotion.id), 'CJ프레시웨이 목록에 노출되어야 한다');
});

test('시나리오 1 상세: 로그인 성공 시 refresh token이 HttpOnly 쿠키로, 필수값 누락 시 등록이 거부된다', async () => {
  const email = uniqueEmail();
  await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'partner', company_name: uniqueCompany('시나리오1 협력사'), email, password: PASSWORD }),
  });
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /refresh_token=/, 'refresh token 쿠키가 발급되어야 한다');
  assert.match(setCookie, /HttpOnly/i, '쿠키는 HttpOnly여야 한다');

  const token = (await loginRes.json()).access_token;
  const missingItemsRes = await authed(token, 'POST', '/promotions', {
    start_date: '2095-01-01',
    end_date: '2095-01-10',
    condition: '10% 할인',
    items: [],
  });
  assert.strictEqual(missingItemsRes.status, 400, '대상 품목 없이는 등록되지 않아야 한다');
});

test('시나리오 1 상세: 협력사는 다른 협력사의 프로모션을 목록에서 볼 수 없다', async () => {
  const partnerA = await signupAndLogin('partner', uniqueCompany('시나리오1 협력사A'));
  const partnerB = await signupAndLogin('partner', uniqueCompany('시나리오1 협력사B'));

  const created = await (
    await authed(partnerA.token, 'POST', '/promotions', {
      start_date: '2095-01-15',
      end_date: '2095-01-20',
      condition: '10% 할인',
      items: [{ name: `시나리오1품목B-${crypto.randomUUID()}` }],
    })
  ).json();

  const listRes = await authed(partnerB.token, 'GET', '/promotions?limit=1000');
  const list = await listRes.json();
  const promotions = Array.isArray(list) ? list : list.items;
  assert.ok(!promotions.some((p) => p.id === created.id), '다른 협력사의 프로모션은 보이지 않아야 한다');
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

test('시나리오 2 상세: 협력사 계정은 승인할 수 없고(EC-01), 이미 승인된 건은 재승인 시 409', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오2 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-02-15',
      end_date: '2095-02-20',
      condition: '10% 할인',
      items: [{ name: `시나리오2품목B-${crypto.randomUUID()}` }],
    })
  ).json();

  const partnerAttempt = await authed(partner.token, 'PATCH', `/promotions/${created.id}/approve`);
  assert.strictEqual(partnerAttempt.status, 403, '협력사 계정은 직접 승인할 수 없다');

  await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);
  const reapprove = await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);
  assert.strictEqual(reapprove.status, 409, '이미 승인된 프로모션은 다시 승인할 수 없다');
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

test('시나리오 3 상세: 협력사 계정은 반려할 수 없고(EC-01), 이미 반려된 건은 재반려 시 409', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오3 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-03-15',
      end_date: '2095-03-20',
      condition: '10% 할인',
      items: [{ name: `시나리오3품목B-${crypto.randomUUID()}` }],
    })
  ).json();

  const partnerAttempt = await authed(partner.token, 'PATCH', `/promotions/${created.id}/reject`, {
    reject_reason: '아무 사유',
  });
  assert.strictEqual(partnerAttempt.status, 403, '협력사 계정은 직접 반려할 수 없다');

  await authed(cj.token, 'PATCH', `/promotions/${created.id}/reject`, { reject_reason: '사유1' });
  const reReject = await authed(cj.token, 'PATCH', `/promotions/${created.id}/reject`, { reject_reason: '사유2' });
  assert.strictEqual(reReject.status, 409, '이미 반려된 프로모션은 다시 반려할 수 없다');
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

  const historyRes = await authed(cj.token, 'GET', `/promotions/${created.id}/change-requests`);
  const history = await historyRes.json();
  assert.ok(history.some((cr) => cr.id === changeRequest.id && cr.apply_status === 'applied'), '반영 이력이 조회되어야 한다');
});

test('시나리오 4 상세: 협력사만 변경요청을 등록할 수 있고(내용 필수), CJ프레시웨이만 반영거부 처리할 수 있다', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오4 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const created = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-04-15',
      end_date: '2095-04-20',
      condition: '10% 할인',
      items: [{ name: `시나리오4품목B-${crypto.randomUUID()}` }],
    })
  ).json();
  await authed(cj.token, 'PATCH', `/promotions/${created.id}/approve`);

  const cjAttempt = await authed(cj.token, 'POST', `/promotions/${created.id}/change-requests`, { content: '내용' });
  assert.strictEqual(cjAttempt.status, 403, 'CJ프레시웨이는 변경요청을 등록할 수 없다');

  const withoutContent = await authed(partner.token, 'POST', `/promotions/${created.id}/change-requests`, {});
  assert.strictEqual(withoutContent.status, 400, '변경 내용 없이는 등록되지 않아야 한다');

  const crRes = await authed(partner.token, 'POST', `/promotions/${created.id}/change-requests`, { content: '조건 변경 요청' });
  const changeRequest = await crRes.json();

  const partnerAttempt = await authed(partner.token, 'PATCH', `/change-requests/${changeRequest.id}`, { apply_status: 'rejected' });
  assert.strictEqual(partnerAttempt.status, 403, '협력사는 직접 반영거부 처리할 수 없다');

  const rejectRes = await authed(cj.token, 'PATCH', `/change-requests/${changeRequest.id}`, { apply_status: 'rejected' });
  assert.strictEqual(rejectRes.status, 200);
  const rejected = await rejectRes.json();
  assert.strictEqual(rejected.apply_status, 'rejected');
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

test('시나리오 5 상세: 협력사는 취소/재오픈을 할 수 없고(EC-01), 취소 불가 상태·재오픈 불가 상태는 409', async () => {
  const partner = await signupAndLogin('partner', uniqueCompany('시나리오5 협력사'));
  const cj = await signupAndLogin('cj_freshway', uniqueCompany('CJ프레시웨이'));

  const proposed = await (
    await authed(partner.token, 'POST', '/promotions', {
      start_date: '2095-05-15',
      end_date: '2095-05-20',
      condition: '10% 할인',
      items: [{ name: `시나리오5품목B-${crypto.randomUUID()}` }],
    })
  ).json();

  const partnerCancelAttempt = await authed(partner.token, 'PATCH', `/promotions/${proposed.id}/cancel`, {
    cancel_reason: '아무 사유',
  });
  assert.strictEqual(partnerCancelAttempt.status, 403, '협력사 계정은 직접 취소할 수 없다');

  const cancelProposed = await authed(cj.token, 'PATCH', `/promotions/${proposed.id}/cancel`, {
    cancel_reason: '아무 사유',
  });
  assert.strictEqual(cancelProposed.status, 409, '제안됨 상태는 취소 대상이 아니다(승인됨/진행중만 취소 가능)');

  const partnerReopenAttempt = await authed(partner.token, 'PATCH', `/promotions/${proposed.id}/reopen`);
  assert.strictEqual(partnerReopenAttempt.status, 403, '협력사 계정은 직접 재오픈할 수 없다');

  const reopenProposed = await authed(cj.token, 'PATCH', `/promotions/${proposed.id}/reopen`);
  assert.strictEqual(reopenProposed.status, 409, '제안됨 상태는 재오픈 대상이 아니다(취소됨/종료만 재오픈 가능, EC-02)');
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

test('시나리오 6 상세: 협력사 담당자도 캘린더를 동일하게 이용하되 본인 프로모션 범위로 조회된다', async () => {
  const partnerA = await signupAndLogin('partner', uniqueCompany('시나리오6 협력사A'));
  const partnerB = await signupAndLogin('partner', uniqueCompany('시나리오6 협력사B'));

  const createdA = await (
    await authed(partnerA.token, 'POST', '/promotions', {
      start_date: '2095-06-11',
      end_date: '2095-06-15',
      condition: '10% 할인',
      items: [{ name: `시나리오6품목A-${crypto.randomUUID()}` }],
    })
  ).json();
  const createdB = await (
    await authed(partnerB.token, 'POST', '/promotions', {
      start_date: '2095-06-12',
      end_date: '2095-06-16',
      condition: '10% 할인',
      items: [{ name: `시나리오6품목B-${crypto.randomUUID()}` }],
    })
  ).json();

  const calendarRes = await authed(partnerA.token, 'GET', '/promotions?from=2095-06-01&to=2095-06-30');
  const calendarList = await calendarRes.json();
  const calendarPromotions = Array.isArray(calendarList) ? calendarList : calendarList.items;
  assert.ok(calendarPromotions.some((p) => p.id === createdA.id), '본인 프로모션은 캘린더에 표시되어야 한다');
  assert.ok(!calendarPromotions.some((p) => p.id === createdB.id), '다른 협력사의 프로모션은 표시되지 않아야 한다');
});
