const pool = require('../db/pool');

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}

function notFoundError() {
  const err = new Error('프로모션을 찾을 수 없습니다');
  err.status = 404;
  err.code = 'NOT_FOUND';
  return err;
}

function invalidTransition(message) {
  const err = new Error(message);
  err.status = 409;
  err.code = 'INVALID_TRANSITION';
  return err;
}

const APPROVABLE_FROM = ['proposed', 'in_review'];
const REJECTABLE_FROM = ['proposed', 'in_review'];
const CANCELLABLE_FROM = ['approved', 'active'];

const REOPENABLE_FROM = ['closed', 'cancelled'];

function canApprove(status) { return APPROVABLE_FROM.includes(status); }
function canReject(status) { return REJECTABLE_FROM.includes(status); }
function canCancel(status) { return CANCELLABLE_FROM.includes(status); }
function canReopen(status) { return REOPENABLE_FROM.includes(status); }

function periodsOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

async function findPromotionOrThrow(id) {
  const result = await pool.query('SELECT * FROM promotions WHERE id = $1', [id]);
  const promotion = result.rows[0];
  if (!promotion) throw notFoundError();
  return promotion;
}

async function fillItems(promotion) {
  const result = await pool.query(
    'SELECT i.* FROM items i JOIN promotion_items pi ON pi.item_id = i.id WHERE pi.promotion_id = $1',
    [promotion.id]
  );
  return { ...promotion, items: result.rows };
}

async function checkOverlapWarning({ excludePromotionId, companyName, itemNames, startDate, endDate }) {
  if (!itemNames || itemNames.length === 0) return false;

  const params = [companyName, itemNames, startDate, endDate];
  let sql = `
    SELECT 1
    FROM promotions p
    JOIN users u ON u.id = p.proposer_id
    JOIN promotion_items pi ON pi.promotion_id = p.id
    JOIN items i ON i.id = pi.item_id
    WHERE u.company_name = $1
      AND i.name = ANY($2)
      AND p.start_date <= $4 AND p.end_date >= $3
  `;
  if (excludePromotionId) {
    params.push(excludePromotionId);
    sql += ` AND p.id != $${params.length}`;
  }
  sql += ' LIMIT 1';

  const result = await pool.query(sql, params);
  return result.rows.length > 0;
}

async function createPromotion({ proposerId, start_date, end_date, condition, items }) {
  if (!start_date || !end_date || !condition || !Array.isArray(items) || items.length === 0) {
    throw validationError('필수 항목이 누락되었습니다');
  }

  const client = await pool.connect();
  let promotion;
  let createdItems;
  let companyName;
  try {
    await client.query('BEGIN');

    const promotionResult = await client.query(
      'INSERT INTO promotions (proposer_id, start_date, end_date, condition) VALUES ($1,$2,$3,$4) RETURNING *',
      [proposerId, start_date, end_date, condition]
    );
    promotion = promotionResult.rows[0];

    const userResult = await client.query('SELECT company_name FROM users WHERE id = $1', [proposerId]);
    companyName = userResult.rows[0].company_name;

    createdItems = [];
    for (const item of items) {
      const itemResult = await client.query(
        'INSERT INTO items (name, spec) VALUES ($1,$2) RETURNING *',
        [item.name, item.spec ?? null]
      );
      const createdItem = itemResult.rows[0];
      createdItems.push(createdItem);
      await client.query(
        'INSERT INTO promotion_items (promotion_id, item_id) VALUES ($1,$2)',
        [promotion.id, createdItem.id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const overlapWarning = await checkOverlapWarning({
    excludePromotionId: promotion.id,
    companyName,
    itemNames: createdItems.map((item) => item.name),
    startDate: promotion.start_date,
    endDate: promotion.end_date,
  });

  return { ...promotion, items: createdItems, overlap_warning: overlapWarning };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function listPromotions({ userId, role, status, from, to, page, limit }) {
  const conditions = [];
  const params = [];

  if (role === 'partner') {
    params.push(userId);
    conditions.push(`p.proposer_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (from && to) {
    params.push(from, to);
    conditions.push(`p.end_date >= $${params.length - 1} AND p.start_date <= $${params.length}`);
  } else if (from) {
    params.push(from);
    conditions.push(`p.end_date >= $${params.length}`);
  } else if (to) {
    params.push(to);
    conditions.push(`p.start_date <= $${params.length}`);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  // 캘린더 조회(from/to)는 화면에 필요한 기간 전체를 한 번에 그려야 하므로 페이징하지 않는다.
  const isCalendarQuery = Boolean(from || to);
  if (isCalendarQuery) {
    const result = await pool.query(
      `SELECT p.*, u.company_name AS proposer_company_name
       FROM promotions p
       JOIN users u ON u.id = p.proposer_id${where}`,
      params
    );
    // ponytail: N+1, 데이터가 많아지면 JOIN+집계로 교체
    return Promise.all(result.rows.map(fillItems));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  const offset = (pageNum - 1) * limitNum;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM promotions p${where}`,
    params
  );
  const total = countResult.rows[0].total;

  const pageParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT p.*, u.company_name AS proposer_company_name
     FROM promotions p
     JOIN users u ON u.id = p.proposer_id${where}
     ORDER BY p.start_date DESC, p.id
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams
  );
  // ponytail: N+1, 데이터가 많아지면 JOIN+집계로 교체
  const items = await Promise.all(result.rows.map(fillItems));

  return { items, total, page: pageNum, limit: limitNum };
}

async function getPromotionById({ id, userId, role }) {
  const result = await pool.query(
    `SELECT p.*, u.company_name AS proposer_company_name
     FROM promotions p
     JOIN users u ON u.id = p.proposer_id
     WHERE p.id = $1`,
    [id]
  );
  const promotion = result.rows[0];

  if (!promotion) {
    const err = new Error('프로모션을 찾을 수 없습니다');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (role === 'partner' && promotion.proposer_id !== userId) {
    const err = new Error('접근 권한이 없습니다');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  return fillItems(promotion);
}

async function withOverlapWarning(promotion) {
  const filled = await fillItems(promotion);
  const userResult = await pool.query('SELECT company_name FROM users WHERE id = $1', [filled.proposer_id]);
  const overlapWarning = await checkOverlapWarning({
    excludePromotionId: filled.id,
    companyName: userResult.rows[0].company_name,
    itemNames: filled.items.map((item) => item.name),
    startDate: filled.start_date,
    endDate: filled.end_date,
  });
  return { ...filled, overlap_warning: overlapWarning };
}

async function approvePromotion({ id, reviewerId }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canApprove(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 승인할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='approved', reviewer_id=$1 WHERE id=$2 RETURNING *",
    [reviewerId, id]
  );
  return withOverlapWarning(result.rows[0]);
}

async function rejectPromotion({ id, reviewerId, reject_reason }) {
  if (!reject_reason) {
    throw validationError('반려 사유가 필요합니다');
  }

  const promotion = await findPromotionOrThrow(id);
  if (!canReject(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 반려할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='rejected', reviewer_id=$1, reject_reason=$2 WHERE id=$3 RETURNING *",
    [reviewerId, reject_reason, id]
  );
  return fillItems(result.rows[0]);
}

async function cancelPromotion({ id, reviewerId, cancel_reason }) {
  if (!cancel_reason) {
    throw validationError('취소 사유가 필요합니다');
  }

  const promotion = await findPromotionOrThrow(id);
  if (!canCancel(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 취소할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='cancelled', reviewer_id=$1, cancel_reason=$2 WHERE id=$3 RETURNING *",
    [reviewerId, cancel_reason, id]
  );
  return fillItems(result.rows[0]);
}

async function updateAndApprovePromotion({ id, reviewerId, start_date, end_date, condition, items }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canApprove(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 승인할 수 없습니다`);
  }

  const setClauses = [];
  const params = [];
  if (start_date !== undefined) {
    params.push(start_date);
    setClauses.push(`start_date=$${params.length}`);
  }
  if (end_date !== undefined) {
    params.push(end_date);
    setClauses.push(`end_date=$${params.length}`);
  }
  if (condition !== undefined) {
    params.push(condition);
    setClauses.push(`condition=$${params.length}`);
  }
  params.push(reviewerId);
  setClauses.push(`reviewer_id=$${params.length}`);
  setClauses.push("status='approved'");
  params.push(id);

  if (!Array.isArray(items)) {
    const result = await pool.query(
      `UPDATE promotions SET ${setClauses.join(', ')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    return withOverlapWarning(result.rows[0]);
  }

  const client = await pool.connect();
  let updatedPromotion;
  let createdItems;
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE promotions SET ${setClauses.join(', ')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    updatedPromotion = updateResult.rows[0];

    await client.query('DELETE FROM promotion_items WHERE promotion_id=$1', [id]);

    createdItems = [];
    for (const item of items) {
      const itemResult = await client.query(
        'INSERT INTO items (name, spec) VALUES ($1,$2) RETURNING *',
        [item.name, item.spec ?? null]
      );
      const createdItem = itemResult.rows[0];
      createdItems.push(createdItem);
      await client.query(
        'INSERT INTO promotion_items (promotion_id, item_id) VALUES ($1,$2)',
        [id, createdItem.id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const userResult = await pool.query('SELECT company_name FROM users WHERE id = $1', [updatedPromotion.proposer_id]);
  const overlapWarning = await checkOverlapWarning({
    excludePromotionId: updatedPromotion.id,
    companyName: userResult.rows[0].company_name,
    itemNames: createdItems.map((item) => item.name),
    startDate: updatedPromotion.start_date,
    endDate: updatedPromotion.end_date,
  });

  return { ...updatedPromotion, items: createdItems, overlap_warning: overlapWarning };
}

async function reopenPromotion({ id }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canReopen(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 재오픈할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='in_review' WHERE id=$1 RETURNING *",
    [id]
  );
  return fillItems(result.rows[0]);
}

module.exports = {
  createPromotion,
  listPromotions,
  getPromotionById,
  approvePromotion,
  rejectPromotion,
  cancelPromotion,
  updateAndApprovePromotion,
  reopenPromotion,
  canApprove,
  canReject,
  canCancel,
  canReopen,
  periodsOverlap,
  checkOverlapWarning,
};
