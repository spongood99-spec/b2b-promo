const pool = require('../db/pool');
const notificationsService = require('./notifications.service');

const POST_APPROVAL_STATUSES = ['approved', 'active', 'closed', 'cancelled'];
function isPostApprovalStatus(status) {
  return POST_APPROVAL_STATUSES.includes(status);
}

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}
function notFoundError(message) {
  const err = new Error(message);
  err.status = 404;
  err.code = 'NOT_FOUND';
  return err;
}
function forbiddenError(message) {
  const err = new Error(message);
  err.status = 403;
  err.code = 'FORBIDDEN';
  return err;
}
function invalidTransition(message) {
  const err = new Error(message);
  err.status = 409;
  err.code = 'INVALID_TRANSITION';
  return err;
}

async function createChangeRequest({ promotionId, requesterId, content }) {
  if (!content) throw validationError('변경 요청 내용은 필수입니다');

  const promoRes = await pool.query('SELECT status, proposer_id FROM promotions WHERE id = $1', [promotionId]);
  if (promoRes.rows.length === 0) throw notFoundError('프로모션을 찾을 수 없습니다');
  if (promoRes.rows[0].proposer_id !== requesterId) {
    throw forbiddenError('접근 권한이 없습니다');
  }

  const isPostApproval = isPostApprovalStatus(promoRes.rows[0].status);

  const res = await pool.query(
    `INSERT INTO change_requests (promotion_id, requester_id, content, is_post_approval_change)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [promotionId, requesterId, content, isPostApproval]
  );

  const requesterRes = await pool.query('SELECT company_name FROM users WHERE id = $1', [requesterId]);
  await notificationsService
    .notifyAllCjFreshway({
      promotionId,
      type: 'new_change_request',
      message: `${requesterRes.rows[0].company_name}에서 변경요청을 등록했습니다.`,
    })
    .catch((err) => console.error('notification failed', err));

  return res.rows[0];
}

async function listChangeRequestsByPromotion({ promotionId, userId, role }) {
  const promoRes = await pool.query('SELECT proposer_id FROM promotions WHERE id = $1', [promotionId]);
  if (promoRes.rows.length === 0) throw notFoundError('프로모션을 찾을 수 없습니다');
  if (role === 'partner' && promoRes.rows[0].proposer_id !== userId) {
    throw forbiddenError('접근 권한이 없습니다');
  }
  const res = await pool.query(
    `SELECT cr.*, u.company_name AS requester_company_name
     FROM change_requests cr
     JOIN users u ON u.id = cr.requester_id
     WHERE cr.promotion_id = $1
     ORDER BY cr.created_at`,
    [promotionId]
  );
  return res.rows;
}

async function updateChangeRequestStatus({ id, apply_status }) {
  if (!['applied', 'rejected'].includes(apply_status)) {
    throw validationError('apply_status는 applied 또는 rejected여야 합니다');
  }
  // 이미 처리된(applied/rejected) 건은 재처리를 막는다 — 막지 않으면 중복 클릭/뒤로가기로
  // 상태가 반복 뒤집히고 그때마다 알림이 중복 발송된다.
  const res = await pool.query(
    "UPDATE change_requests SET apply_status = $1 WHERE id = $2 AND apply_status = 'pending' RETURNING *",
    [apply_status, id]
  );
  if (res.rows.length === 0) {
    const existing = await pool.query('SELECT id FROM change_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw notFoundError('변경요청을 찾을 수 없습니다');
    throw invalidTransition('이미 처리된 변경요청입니다');
  }

  const changeRequest = res.rows[0];
  await notificationsService
    .notifyUser({
      userId: changeRequest.requester_id,
      promotionId: changeRequest.promotion_id,
      type: apply_status === 'applied' ? 'change_request_applied' : 'change_request_rejected',
      message: apply_status === 'applied' ? '변경요청이 반영완료되었습니다.' : '변경요청이 반영거부되었습니다.',
    })
    .catch((err) => console.error('notification failed', err));

  return changeRequest;
}

module.exports = {
  isPostApprovalStatus,
  createChangeRequest,
  listChangeRequestsByPromotion,
  updateChangeRequestStatus,
};
