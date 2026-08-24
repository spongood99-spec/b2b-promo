const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// 재제출/알림/13개 실무속성이 각자 단독으로는 테스트되어 있지만, 세 기능이 한 흐름 안에서
// 서로 간섭 없이 동작하는지(재제출 시 실무속성 유지·수정, 알림이 정확한 개수로만 쌓이는지,
// 승인후변경과 실무속성이 공존하는지)는 아직 검증된 적이 없어 이 파일에서 다룬다.

let server;
let baseUrl;

const PASSWORD = 'password123!';
const uniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;

const signupAndLogin = async (role, companyName = `Test Company ${crypto.randomUUID()}`) => {
  const email = uniqueEmail();
  await fetch(`${baseUrl}/auth/signup`, {
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
  return { token: body.access_token };
};

const createPromotion = async (token, overrides = {}) => {
  const res = await fetch(`${baseUrl}/promotions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      start_date: '2094-01-01',
      end_date: '2094-01-10',
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

const post = (token, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });

const getNotifications = (token) =>
  fetch(`${baseUrl}/notifications?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

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

test('재제출 시 실무속성은 보낸 값만 갱신되고, 그 결과 승인까지 알림이 정확한 개수로 쌓인다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  const created = await createPromotion(partner.token, {
    moq: 10,
    contact_name: '최초담당자',
  });
  assert.strictEqual(created.moq, 10);
  assert.strictEqual(created.contact_name, '최초담당자');

  await patch(cj.token, `/promotions/${created.id}/reject`, { reject_reason: '조건 재검토 필요' });

  const resubmitRes = await patch(partner.token, `/promotions/${created.id}/resubmit`, {
    start_date: '2094-02-01',
    end_date: '2094-02-10',
    condition: '수정된 조건',
    items: [{ name: '수정된 품목' }],
    moq: 999, // 갱신
    // contact_name은 보내지 않음 -> 기존 값 유지되어야 함
  });
  assert.strictEqual(resubmitRes.status, 200);
  const resubmitted = await resubmitRes.json();
  assert.strictEqual(resubmitted.status, 'proposed');
  assert.strictEqual(resubmitted.reject_reason, null);
  assert.strictEqual(resubmitted.moq, 999, '보낸 필드는 갱신되어야 한다');
  assert.strictEqual(resubmitted.contact_name, '최초담당자', '보내지 않은 필드는 기존 값을 유지해야 한다');

  const approveRes = await patch(cj.token, `/promotions/${created.id}/approve`);
  assert.strictEqual(approveRes.status, 200);

  const partnerNotifications = await getNotifications(partner.token);
  const cjNotifications = await getNotifications(cj.token);

  const rejectedCount = partnerNotifications.filter((n) => n.promotion_id === created.id && n.type === 'rejected').length;
  const approvedCount = partnerNotifications.filter((n) => n.promotion_id === created.id && n.type === 'approved').length;
  const newPromotionCount = cjNotifications.filter((n) => n.promotion_id === created.id && n.type === 'new_promotion').length;
  const resubmittedCount = cjNotifications.filter((n) => n.promotion_id === created.id && n.type === 'resubmitted').length;

  assert.strictEqual(rejectedCount, 1, '반려 알림은 정확히 1건이어야 한다');
  assert.strictEqual(approvedCount, 1, '승인 알림은 정확히 1건이어야 한다');
  assert.strictEqual(newPromotionCount, 1, '신규 등록 알림은 정확히 1건이어야 한다');
  assert.strictEqual(resubmittedCount, 1, '재제출 알림은 정확히 1건이어야 한다');
});

test('승인후변경(변경요청)과 실무속성이 동시에 존재해도 서로 값이 섞이지 않는다', async () => {
  const partner = await signupAndLogin('partner');
  const cj = await signupAndLogin('cj_freshway');

  const created = await createPromotion(partner.token, {
    discount_type: '정률할인',
    discount_value: 15,
    target_channel: '단체급식',
  });

  await patch(cj.token, `/promotions/${created.id}/approve`);

  const crRes = await post(partner.token, `/promotions/${created.id}/change-requests`, { content: '단가 재협의 요청' });
  assert.strictEqual(crRes.status, 201);
  const changeRequest = await crRes.json();
  assert.strictEqual(changeRequest.is_post_approval_change, true);

  const detailRes = await fetch(`${baseUrl}/promotions/${created.id}`, {
    headers: { Authorization: `Bearer ${cj.token}` },
  });
  const detail = await detailRes.json();
  assert.strictEqual(detail.status, 'approved', '변경요청 등록만으로 프로모션 상태가 바뀌지 않아야 한다');
  assert.strictEqual(detail.discount_type, '정률할인', '실무속성은 변경요청과 무관하게 그대로 유지되어야 한다');
  assert.strictEqual(Number(detail.discount_value), 15);
  assert.strictEqual(detail.target_channel, '단체급식');

  await patch(cj.token, `/change-requests/${changeRequest.id}`, { apply_status: 'applied' });
  const partnerNotifications = await getNotifications(partner.token);
  const appliedCount = partnerNotifications.filter(
    (n) => n.promotion_id === created.id && n.type === 'change_request_applied'
  ).length;
  assert.strictEqual(appliedCount, 1);
});
