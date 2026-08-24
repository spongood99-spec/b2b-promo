const { test, before, after } = require('node:test');
const assert = require('node:assert');

let server;
let baseUrl;

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

test('GET /health returns 200 with { status: "ok" } (pool.query 성공 포함)', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
});

test('GET /no-such-path-xyz returns 404 with common error format', async () => {
  const res = await fetch(`${baseUrl}/no-such-path-xyz`);
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.error.code, 'NOT_FOUND');
  assert.strictEqual(typeof body.error.message, 'string');
});

test('helmet 보안 헤더(X-Content-Type-Options, X-Frame-Options)가 응답에 포함된다', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options'));
});
