const { test } = require('node:test');
const assert = require('node:assert');
const { canApprove, canReject, canCancel } = require('./promotions.service');
const { isPostApprovalStatus } = require('./changeRequests.service');

// 다음 전이는 구현된 API/함수가 없어 이 파일의 테스트 대상이 아님 (9-plan.md BE-1~BE-9 확인 완료):
// - proposed → in_review 진입 (검토 시작 엔드포인트 없음, in_review는 승인/반려 대상 상태로만 존재)
// - approved → active, active → closed (관련 API 없음, MVP 범위 밖)
// - rejected → proposed 재제안 (도메인 정의서 6장에만 존재, BE 태스크 목록에 없음)

test('정상 경로: proposed/in_review → approved', () => {
  assert.strictEqual(canApprove('proposed'), true);
  assert.strictEqual(canApprove('in_review'), true);
});

test('정상 경로: proposed/in_review → rejected', () => {
  assert.strictEqual(canReject('proposed'), true);
  assert.strictEqual(canReject('in_review'), true);
});

test('정상 경로: approved/active → cancelled', () => {
  assert.strictEqual(canCancel('approved'), true);
  assert.strictEqual(canCancel('active'), true);
});

test('금지된 전이: closed → approved는 거부된다', () => {
  assert.strictEqual(canApprove('closed'), false);
});

test('금지된 전이: cancelled 상태에서는 approve/reject/cancel 모두 거부된다', () => {
  assert.strictEqual(canApprove('cancelled'), false);
  assert.strictEqual(canReject('cancelled'), false);
  assert.strictEqual(canCancel('cancelled'), false);
});

test('EC-03: is_post_approval_change는 승인 전(false)/후(true)을 구분한다', () => {
  assert.strictEqual(isPostApprovalStatus('proposed'), false);
  assert.strictEqual(isPostApprovalStatus('approved'), true);
});
