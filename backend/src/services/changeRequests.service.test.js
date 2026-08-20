const { test } = require('node:test');
const assert = require('node:assert');
const { isPostApprovalStatus } = require('./changeRequests.service');

const cases = [
  ['proposed', false],
  ['in_review', false],
  ['approved', true],
  ['rejected', false],
  ['active', true],
  ['closed', true],
  ['cancelled', true],
];

for (const [status, expected] of cases) {
  test(`isPostApprovalStatus('${status}') === ${expected}`, () => {
    assert.strictEqual(isPostApprovalStatus(status), expected);
  });
}
