const { test } = require('node:test');
const assert = require('node:assert');
const { canApprove, canReject, canCancel } = require('./promotions.service');

const STATUSES = ['proposed', 'in_review', 'approved', 'rejected', 'active', 'closed', 'cancelled'];

test('canApprove는 proposed/in_review일 때만 true를 반환한다', () => {
  const expected = {
    proposed: true,
    in_review: true,
    approved: false,
    rejected: false,
    active: false,
    closed: false,
    cancelled: false,
  };
  for (const status of STATUSES) {
    assert.strictEqual(canApprove(status), expected[status], `canApprove(${status})`);
  }
});

test('canReject는 proposed/in_review일 때만 true를 반환한다', () => {
  const expected = {
    proposed: true,
    in_review: true,
    approved: false,
    rejected: false,
    active: false,
    closed: false,
    cancelled: false,
  };
  for (const status of STATUSES) {
    assert.strictEqual(canReject(status), expected[status], `canReject(${status})`);
  }
});

test('canCancel은 approved/active일 때만 true를 반환한다', () => {
  const expected = {
    proposed: false,
    in_review: false,
    approved: true,
    rejected: false,
    active: true,
    closed: false,
    cancelled: false,
  };
  for (const status of STATUSES) {
    assert.strictEqual(canCancel(status), expected[status], `canCancel(${status})`);
  }
});
