const pool = require('../db/pool');
const notificationsService = require('./notifications.service');

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

function forbiddenError(message) {
  const err = new Error(message);
  err.status = 403;
  err.code = 'FORBIDDEN';
  return err;
}

const APPROVABLE_FROM = ['proposed', 'in_review'];
const REJECTABLE_FROM = ['proposed', 'in_review'];
const CANCELLABLE_FROM = ['approved', 'active'];

const REOPENABLE_FROM = ['closed', 'cancelled'];
const RESUBMITTABLE_FROM = ['rejected'];

// 협력사 실무 제안 속성 (선택 입력, 2026-08-21 v1.5 — docs/1-domain-definition.md 참고)
const DISCOUNT_TYPES = ['정률할인', '정액할인', '사은품', '1+1', '기타'];
const PROMOTION_TYPES = ['신제품출시', '시즌행사', '재고소진', '단순할인', '기타'];
const EXTRA_FIELDS = [
  'discount_type',
  'discount_value',
  'partner_cost_share_pct',
  'moq',
  'available_qty',
  'lead_time_days',
  'contact_name',
  'contact_phone',
  'origin_and_cert',
  'shelf_life_and_storage',
  'promotion_type',
  'target_channel',
  'attachment_url',
];

const NON_NEGATIVE_NUMERIC_FIELDS = {
  discount_value: '할인값',
  moq: '최소주문수량',
  available_qty: '공급가능수량',
  lead_time_days: '리드타임',
};

// DB integer 컬럼(moq/available_qty/lead_time_days)은 소수/int4 범위 초과 값을 받으면
// 애플리케이션 검증 없이 DB로 내려가 500(22P02/22003)이 나므로, 여기서 먼저 걸러낸다.
const INTEGER_FIELDS = new Set(['moq', 'available_qty', 'lead_time_days']);
const MAX_INT4 = 2147483647;

// varchar 컬럼 길이 제한(docs/8-schema.sql)을 애플리케이션에서도 검증해 500(22001) 대신 400을 반환한다.
const STRING_LENGTH_LIMITS = {
  contact_name: 100,
  contact_phone: 50,
  target_channel: 200,
  attachment_url: 500,
};

function validateExtraFields(payload) {
  if (payload.discount_type != null && !DISCOUNT_TYPES.includes(payload.discount_type)) {
    throw validationError('할인유형 값이 올바르지 않습니다');
  }
  if (payload.promotion_type != null && !PROMOTION_TYPES.includes(payload.promotion_type)) {
    throw validationError('프로모션유형 값이 올바르지 않습니다');
  }
  if (payload.partner_cost_share_pct != null) {
    const pct = Number(payload.partner_cost_share_pct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw validationError('협력사부담율은 0~100 사이 숫자여야 합니다');
    }
  }
  for (const [field, label] of Object.entries(NON_NEGATIVE_NUMERIC_FIELDS)) {
    if (payload[field] == null) continue;
    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw validationError(`${label}은 0 이상의 숫자여야 합니다`);
    }
    if (INTEGER_FIELDS.has(field) && (!Number.isInteger(value) || value > MAX_INT4)) {
      throw validationError(`${label}은 정수여야 하며 너무 큰 값일 수 없습니다`);
    }
  }
  for (const [field, maxLength] of Object.entries(STRING_LENGTH_LIMITS)) {
    if (payload[field] != null && String(payload[field]).length > maxLength) {
      throw validationError(`${field} 값이 너무 길습니다(최대 ${maxLength}자)`);
    }
  }
  if (payload.attachment_url != null && payload.attachment_url !== '' && !/^https?:\/\//i.test(payload.attachment_url)) {
    throw validationError('첨부링크는 http:// 또는 https://로 시작해야 합니다');
  }
}

function validateDateOrder(startDate, endDate) {
  if (startDate && endDate && String(endDate) < String(startDate)) {
    throw validationError('종료일은 시작일보다 이전일 수 없습니다');
  }
}

const MAX_ITEMS = 50;

function validateItems(items) {
  if (items.length > MAX_ITEMS) {
    throw validationError(`품목은 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다`);
  }
  for (const item of items) {
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      throw validationError('품목명은 비어 있을 수 없습니다');
    }
    if (item.name.length > 200) {
      throw validationError('품목명은 최대 200자까지 입력할 수 있습니다');
    }
    if (item.spec != null && String(item.spec).length > 100) {
      throw validationError('품목 규격은 최대 100자까지 입력할 수 있습니다');
    }
  }
}

function appendOptionalSetClauses(setClauses, params, payload, fields) {
  for (const field of fields) {
    if (payload[field] !== undefined) {
      params.push(payload[field]);
      setClauses.push(`${field}=$${params.length}`);
    }
  }
}

function canApprove(status) { return APPROVABLE_FROM.includes(status); }
function canReject(status) { return REJECTABLE_FROM.includes(status); }
function canCancel(status) { return CANCELLABLE_FROM.includes(status); }
function canReopen(status) { return REOPENABLE_FROM.includes(status); }
function canResubmit(status) { return RESUBMITTABLE_FROM.includes(status); }

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

async function createPromotion({ proposerId, start_date, end_date, condition, items, ...extra }) {
  if (!start_date || !end_date || !condition || !Array.isArray(items) || items.length === 0) {
    throw validationError('필수 항목이 누락되었습니다');
  }
  validateDateOrder(start_date, end_date);
  validateItems(items);
  validateExtraFields(extra);

  const client = await pool.connect();
  let promotion;
  let createdItems;
  let companyName;
  try {
    await client.query('BEGIN');

    const extraValues = EXTRA_FIELDS.map((field) => extra[field] ?? null);
    const extraPlaceholders = EXTRA_FIELDS.map((_, i) => `$${i + 5}`).join(', ');
    const promotionResult = await client.query(
      `INSERT INTO promotions (proposer_id, start_date, end_date, condition, ${EXTRA_FIELDS.join(', ')})
       VALUES ($1,$2,$3,$4, ${extraPlaceholders}) RETURNING *`,
      [proposerId, start_date, end_date, condition, ...extraValues]
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

  await notificationsService
    .notifyAllCjFreshway({
      promotionId: promotion.id,
      type: 'new_promotion',
      message: `${companyName}에서 새 프로모션을 등록했습니다.`,
    })
    .catch((err) => console.error('notification failed', err));

  return { ...promotion, items: createdItems, overlap_warning: overlapWarning };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function listPromotions({ userId, role, status, from, to, page, limit, q }) {
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
  if (q) {
    params.push(`%${q}%`);
    const qIndex = params.length;
    conditions.push(
      `(p.condition ILIKE $${qIndex} OR u.company_name ILIKE $${qIndex} OR EXISTS (
        SELECT 1 FROM promotion_items pi2 JOIN items i2 ON i2.id = pi2.item_id
        WHERE pi2.promotion_id = p.id AND i2.name ILIKE $${qIndex}
      ))`
    );
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
    `SELECT COUNT(*)::int AS total FROM promotions p JOIN users u ON u.id = p.proposer_id${where}`,
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

async function getPromotionStats({ userId, role }) {
  const params = [];
  let where = '';
  if (role === 'partner') {
    params.push(userId);
    where = 'WHERE proposer_id = $1';
  }
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM promotions ${where} GROUP BY status`,
    params
  );
  const stats = {};
  for (const row of result.rows) stats[row.status] = row.count;
  return stats;
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

// 동시성 가드: 상태 확인과 UPDATE 사이에 다른 요청이 먼저 상태를 바꿔버리는 TOCTOU 레이스를 막기 위해
// UPDATE 자체의 WHERE에도 허용 상태 목록을 걸고, 0행이면(그 사이 상태가 바뀐 것) 409로 처리한다.
function concurrentTransitionError() {
  return invalidTransition('다른 요청에 의해 프로모션 상태가 이미 변경되었습니다');
}

async function approvePromotion({ id, reviewerId }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canApprove(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 승인할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='approved', reviewer_id=$1 WHERE id=$2 AND status = ANY($3) RETURNING *",
    [reviewerId, id, APPROVABLE_FROM]
  );
  if (result.rowCount === 0) throw concurrentTransitionError();
  await notificationsService
    .notifyUser({
      userId: promotion.proposer_id,
      promotionId: id,
      type: 'approved',
      message: '프로모션이 승인되었습니다.',
    })
    .catch((err) => console.error('notification failed', err));
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
    "UPDATE promotions SET status='rejected', reviewer_id=$1, reject_reason=$2 WHERE id=$3 AND status = ANY($4) RETURNING *",
    [reviewerId, reject_reason, id, REJECTABLE_FROM]
  );
  if (result.rowCount === 0) throw concurrentTransitionError();
  await notificationsService
    .notifyUser({
      userId: promotion.proposer_id,
      promotionId: id,
      type: 'rejected',
      message: `프로모션이 반려되었습니다. (사유: ${reject_reason})`,
    })
    .catch((err) => console.error('notification failed', err));
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
    "UPDATE promotions SET status='cancelled', reviewer_id=$1, cancel_reason=$2 WHERE id=$3 AND status = ANY($4) RETURNING *",
    [reviewerId, cancel_reason, id, CANCELLABLE_FROM]
  );
  if (result.rowCount === 0) throw concurrentTransitionError();
  return fillItems(result.rows[0]);
}

async function updateAndApprovePromotion({ id, reviewerId, start_date, end_date, condition, items, ...extra }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canApprove(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 승인할 수 없습니다`);
  }
  validateDateOrder(
    start_date !== undefined ? start_date : promotion.start_date,
    end_date !== undefined ? end_date : promotion.end_date
  );
  if (Array.isArray(items)) validateItems(items);
  validateExtraFields(extra);

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
  appendOptionalSetClauses(setClauses, params, extra, EXTRA_FIELDS);
  params.push(reviewerId);
  setClauses.push(`reviewer_id=$${params.length}`);
  setClauses.push("status='approved'");
  params.push(id);

  const statusGuardIndex = params.length + 1;
  params.push(APPROVABLE_FROM);
  const whereClause = `WHERE id=$${params.length - 1} AND status = ANY($${statusGuardIndex})`;

  if (!Array.isArray(items)) {
    const result = await pool.query(
      `UPDATE promotions SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      params
    );
    if (result.rowCount === 0) throw concurrentTransitionError();
    await notificationsService
      .notifyUser({
        userId: promotion.proposer_id,
        promotionId: id,
        type: 'approved',
        message: '수정된 내용으로 프로모션이 승인되었습니다.',
      })
      .catch((err) => console.error('notification failed', err));
    return withOverlapWarning(result.rows[0]);
  }

  const client = await pool.connect();
  let updatedPromotion;
  let createdItems;
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE promotions SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      params
    );
    if (updateResult.rowCount === 0) throw concurrentTransitionError();
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

  await notificationsService
    .notifyUser({
      userId: updatedPromotion.proposer_id,
      promotionId: id,
      type: 'approved',
      message: '수정된 내용으로 프로모션이 승인되었습니다.',
    })
    .catch((err) => console.error('notification failed', err));

  return { ...updatedPromotion, items: createdItems, overlap_warning: overlapWarning };
}

async function reopenPromotion({ id }) {
  const promotion = await findPromotionOrThrow(id);
  if (!canReopen(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 재오픈할 수 없습니다`);
  }

  const result = await pool.query(
    "UPDATE promotions SET status='in_review' WHERE id=$1 AND status = ANY($2) RETURNING *",
    [id, REOPENABLE_FROM]
  );
  if (result.rowCount === 0) throw concurrentTransitionError();
  return fillItems(result.rows[0]);
}

async function resubmitPromotion({ id, proposerId, start_date, end_date, condition, items, ...extra }) {
  const promotion = await findPromotionOrThrow(id);

  if (promotion.proposer_id !== proposerId) {
    throw forbiddenError('접근 권한이 없습니다');
  }
  if (!canResubmit(promotion.status)) {
    throw invalidTransition(`현재 상태(${promotion.status})에서는 재제출할 수 없습니다`);
  }
  if (!start_date || !end_date || !condition || !Array.isArray(items) || items.length === 0) {
    throw validationError('필수 항목이 누락되었습니다');
  }
  validateDateOrder(start_date, end_date);
  validateItems(items);
  validateExtraFields(extra);

  const setClauses = ["start_date=$1", "end_date=$2", "condition=$3", "status='proposed'", "reject_reason=NULL"];
  const params = [start_date, end_date, condition];
  appendOptionalSetClauses(setClauses, params, extra, EXTRA_FIELDS);
  params.push(id);
  const idIndex = params.length;
  params.push(RESUBMITTABLE_FROM);
  const statusGuardIndex = params.length;

  const client = await pool.connect();
  let updatedPromotion;
  let createdItems;
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE promotions SET ${setClauses.join(', ')} WHERE id=$${idIndex} AND status = ANY($${statusGuardIndex}) RETURNING *`,
      params
    );
    if (updateResult.rowCount === 0) throw concurrentTransitionError();
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

  const userResult = await pool.query('SELECT company_name FROM users WHERE id = $1', [proposerId]);
  const overlapWarning = await checkOverlapWarning({
    excludePromotionId: updatedPromotion.id,
    companyName: userResult.rows[0].company_name,
    itemNames: createdItems.map((item) => item.name),
    startDate: updatedPromotion.start_date,
    endDate: updatedPromotion.end_date,
  });

  await notificationsService
    .notifyAllCjFreshway({
      promotionId: id,
      type: 'resubmitted',
      message: `${userResult.rows[0].company_name}에서 반려된 프로모션을 수정하여 재제출했습니다.`,
    })
    .catch((err) => console.error('notification failed', err));

  return { ...updatedPromotion, items: createdItems, overlap_warning: overlapWarning };
}

module.exports = {
  createPromotion,
  listPromotions,
  getPromotionStats,
  getPromotionById,
  approvePromotion,
  rejectPromotion,
  cancelPromotion,
  updateAndApprovePromotion,
  reopenPromotion,
  resubmitPromotion,
  canApprove,
  canReject,
  canCancel,
  canReopen,
  canResubmit,
  checkOverlapWarning,
};
