const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

let server;
let baseUrl;

const uniqueEmail = () => `test-${crypto.randomUUID()}@example.com`;
const PASSWORD = 'password123!';

const signup = (email, password = PASSWORD) =>
  fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'partner',
      company_name: 'Test Company',
      email,
      password,
    }),
  });

const login = (email, password = PASSWORD) =>
  fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

const extractRefreshCookie = (res) => {
  const cookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')];
  const refreshCookie = cookies.find((c) => c && c.includes('refresh_token='));
  assert.ok(refreshCookie, 'refresh_token cookie should be set');
  return refreshCookie.split(';')[0];
};

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

test('회원가입 시 비밀번호가 8자 미만이면 400이 반환된다', async () => {
  const res = await signup(uniqueEmail(), 'short');
  assert.strictEqual(res.status, 400);
});

test('회원가입 시 회사명/이메일이 컬럼 길이(100/255자)를 초과하면 400을 반환한다(DB 500 대신)', async () => {
  const res = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'partner',
      company_name: 'a'.repeat(101),
      email: uniqueEmail(),
      password: PASSWORD,
    }),
  });
  assert.strictEqual(res.status, 400);
});

test('로그아웃 호출 시 refresh_token 쿠키가 지워진다', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const refreshCookie = extractRefreshCookie(loginRes);
  const loginSetCookie = loginRes.headers.get('set-cookie') || '';

  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: refreshCookie },
  });
  assert.strictEqual(logoutRes.status, 200);
  const setCookie = logoutRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /refresh_token=;/);

  // 로그인 때 심은 쿠키와 동일한 Path/HttpOnly/SameSite/Secure 속성으로 지워야
  // 브라우저(특히 크로스사이트 SameSite=None 컨텍스트)가 실제로 같은 쿠키로 인식해 삭제한다.
  // 이 속성이 어긋나면 로그아웃 후에도 refresh token이 계속 유효하게 남는다.
  for (const attr of ['Path=/auth/refresh', 'HttpOnly']) {
    assert.ok(loginSetCookie.includes(attr), `login cookie should include ${attr}`);
    assert.ok(setCookie.includes(attr), `logout clear-cookie should include ${attr}`);
  }
  const sameSiteMatch = (s) => (s.match(/SameSite=(\w+)/i) || [])[1];
  assert.strictEqual(sameSiteMatch(setCookie), sameSiteMatch(loginSetCookie));
});

test('회원가입 성공 후 동일 이메일 재가입 시 409', async () => {
  const email = uniqueEmail();

  const res1 = await signup(email);
  assert.strictEqual(res1.status, 201);
  const body1 = await res1.json();
  assert.strictEqual(body1.role, 'partner');
  assert.strictEqual(body1.company_name, 'Test Company');
  assert.strictEqual(body1.email, email);
  assert.ok(body1.id);
  assert.strictEqual(body1.password_hash, undefined);
  assert.strictEqual(body1.password, undefined);

  const res2 = await signup(email);
  assert.strictEqual(res2.status, 409);
});

test('로그인 성공 시 access_token(바디) + refresh_token(HttpOnly 쿠키) 발급', async () => {
  const email = uniqueEmail();
  await signup(email);

  const res = await login(email);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(typeof body.access_token, 'string');
  assert.ok(body.user);

  const cookies = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')];
  const refreshCookie = cookies.find((c) => c && c.includes('refresh_token='));
  assert.ok(refreshCookie, 'refresh_token cookie should be set');
  assert.ok(refreshCookie.includes('HttpOnly'));
});

test('잘못된 비밀번호로 로그인 시 401과 { error: { code, message } } 반환', async () => {
  const email = uniqueEmail();
  await signup(email);

  const res = await login(email, 'wrong-password');
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(typeof body.error.code, 'string');
  assert.strictEqual(typeof body.error.message, 'string');
});

test('로그인으로 받은 refresh 쿠키로 /auth/refresh 호출 시 새 access_token 발급', async () => {
  const email = uniqueEmail();
  await signup(email);

  const loginRes = await login(email);
  const refreshCookie = extractRefreshCookie(loginRes);

  const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: refreshCookie },
  });
  assert.strictEqual(refreshRes.status, 200);
  const body = await refreshRes.json();
  assert.strictEqual(typeof body.access_token, 'string');
  assert.ok(body.user);
});

test('비밀번호 변경 성공 시 변경된 비밀번호로만 로그인된다', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const { access_token } = await loginRes.json();

  const changeRes = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({ current_password: PASSWORD, new_password: 'newPassword123!' }),
  });
  assert.strictEqual(changeRes.status, 200);

  const oldLoginRes = await login(email, PASSWORD);
  assert.strictEqual(oldLoginRes.status, 401);

  const newLoginRes = await login(email, 'newPassword123!');
  assert.strictEqual(newLoginRes.status, 200);
});

test('비밀번호 변경 시 현재 비밀번호가 틀리면 401, 인증 없이는 401', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const { access_token } = await loginRes.json();

  const wrongCurrentRes = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({ current_password: 'wrong-password', new_password: 'newPassword123!' }),
  });
  assert.strictEqual(wrongCurrentRes.status, 401);

  const noAuthRes = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: PASSWORD, new_password: 'newPassword123!' }),
  });
  assert.strictEqual(noAuthRes.status, 401);
});

test('비밀번호 변경 시 새 비밀번호가 8자 미만이면 400', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const { access_token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/auth/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({ current_password: PASSWORD, new_password: 'short' }),
  });
  assert.strictEqual(res.status, 400);
});

test('refresh token을 Authorization 헤더(access token 자리)에 넣으면 401이 반환된다', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const refreshCookie = extractRefreshCookie(loginRes);
  const refreshToken = refreshCookie.split('=')[1];

  const res = await fetch(`${baseUrl}/promotions`, {
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  assert.strictEqual(res.status, 401);
});

test('UUID 형식이 아닌 id로 프로모션을 조회하면 400(VALIDATION_ERROR)이 반환되고 내부 DB 에러코드가 노출되지 않는다', async () => {
  const email = uniqueEmail();
  await signup(email);
  const loginRes = await login(email);
  const { access_token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/promotions/not-a-uuid`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
});
