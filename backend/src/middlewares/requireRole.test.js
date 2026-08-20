const { test } = require('node:test');
const assert = require('node:assert');
const requireRole = require('./requireRole');

test('허용되지 않은 role이면 403/FORBIDDEN', () => {
  const req = { user: { role: 'partner' } };
  let err;
  requireRole('cj_freshway')(req, {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 403);
  assert.strictEqual(err.code, 'FORBIDDEN');
});

test('허용된 role이면 next() 인자 없이 호출', () => {
  const req = { user: { role: 'cj_freshway' } };
  let called = false;
  let arg = 'not-called';
  requireRole('cj_freshway')(req, {}, (e) => {
    called = true;
    arg = e;
  });
  assert.strictEqual(called, true);
  assert.strictEqual(arg, undefined);
});

test('req.user가 없으면 401/UNAUTHORIZED', () => {
  const req = {};
  let err;
  requireRole('partner')(req, {}, (e) => {
    err = e;
  });
  assert.strictEqual(err.status, 401);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});
