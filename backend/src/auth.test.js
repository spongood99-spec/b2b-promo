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
