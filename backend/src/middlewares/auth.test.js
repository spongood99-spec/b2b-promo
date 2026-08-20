const { test } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const auth = require('./auth');

const makeReq = (headers = {}) => ({ headers });

test('Authorization 헤더 없으면 401/UNAUTHORIZED', () => {
  let err;
  auth(makeReq(), {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

test('Bearer 형식이 아니면 401/UNAUTHORIZED', () => {
  let err;
  auth(makeReq({ authorization: 'Basic xxx' }), {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

test('만료된 토큰이면 401/UNAUTHORIZED', () => {
  const token = jwt.sign(
    { sub: 'user-1', role: 'partner' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '-1s' }
  );
  let err;
  auth(makeReq({ authorization: `Bearer ${token}` }), {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

test('위조된(다른 시크릿) 토큰이면 401/UNAUTHORIZED', () => {
  const token = jwt.sign(
    { sub: 'user-1', role: 'partner' },
    'wrong-secret',
    { expiresIn: '15m' }
  );
  let err;
  auth(makeReq({ authorization: `Bearer ${token}` }), {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

test('유효한 토큰이면 req.user 설정 후 next() 인자 없이 호출', () => {
  const token = jwt.sign(
    { sub: 'user-1', role: 'partner' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
  const req = makeReq({ authorization: `Bearer ${token}` });
  let called = false;
  let arg = 'not-called';
  auth(req, {}, (e) => {
    called = true;
    arg = e;
  });
  assert.strictEqual(called, true);
  assert.strictEqual(arg, undefined);
  assert.deepStrictEqual(req.user, { id: 'user-1', role: 'partner' });
});
