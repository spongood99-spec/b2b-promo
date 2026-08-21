const pool = require('../db/pool');

async function notifyUser({ userId, promotionId, type, message }) {
  await pool.query(
    'INSERT INTO notifications (user_id, promotion_id, type, message) VALUES ($1, $2, $3, $4)',
    [userId, promotionId ?? null, type, message]
  );
}

// ponytail: 담당 MD 지정 기능이 없어 CJ프레시웨이 계정 전체에 브로드캐스트한다.
// 담당자 지정 기능이 추가되면 대상을 좁히도록 교체.
async function notifyAllCjFreshway({ promotionId, type, message }) {
  const result = await pool.query("SELECT id FROM users WHERE role = 'cj_freshway'");
  await Promise.all(
    result.rows.map((u) => notifyUser({ userId: u.id, promotionId, type, message }))
  );
}

async function listNotifications({ userId, limit }) {
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 5));
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limitNum]
  );
  return result.rows;
}

module.exports = { notifyUser, notifyAllCjFreshway, listNotifications };
