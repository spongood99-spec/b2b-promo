const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const VALID_ROLES = ['partner', 'cj_freshway'];

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
}

async function signup({ role, company_name, email, password }) {
  if (!role || !company_name || !email || !password || !VALID_ROLES.includes(role)) {
    const err = new Error('필수 항목이 누락되었거나 role 값이 올바르지 않습니다');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (password.length < 8) {
    const err = new Error('비밀번호는 8자 이상이어야 합니다');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'INSERT INTO users (role, company_name, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, role, company_name, email',
      [role, company_name, email, passwordHash]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const dupErr = new Error('이미 가입된 이메일입니다');
      dupErr.status = 409;
      dupErr.code = 'EMAIL_ALREADY_EXISTS';
      throw dupErr;
    }
    throw err;
  }
}

async function login({ email, password }) {
  const result = await pool.query(
    'SELECT id, role, company_name, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];

  const invalidErr = () => {
    const err = new Error('이메일 또는 비밀번호가 올바르지 않습니다');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    return err;
  };

  if (!user) {
    throw invalidErr();
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw invalidErr();
  }

  const publicUser = {
    id: user.id,
    role: user.role,
    company_name: user.company_name,
    email: user.email,
  };

  return {
    accessToken: signAccessToken(publicUser),
    refreshToken: signRefreshToken(publicUser),
    user: publicUser,
  };
}

async function refresh(refreshTokenCookie) {
  const unauthorized = () => {
    const err = new Error('인증이 필요합니다');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    return err;
  };

  if (!refreshTokenCookie) {
    throw unauthorized();
  }

  let payload;
  try {
    payload = jwt.verify(refreshTokenCookie, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    throw unauthorized();
  }

  const result = await pool.query(
    'SELECT id, role, company_name, email FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = result.rows[0];
  if (!user) {
    throw unauthorized();
  }

  return { accessToken: signAccessToken(user), user };
}

async function changePassword({ userId, current_password, new_password }) {
  if (!current_password || !new_password) {
    const err = new Error('현재 비밀번호와 새 비밀번호를 모두 입력해야 합니다');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (new_password.length < 8) {
    const err = new Error('새 비밀번호는 8자 이상이어야 합니다');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  const matches = user && (await bcrypt.compare(current_password, user.password_hash));
  if (!matches) {
    const err = new Error('현재 비밀번호가 올바르지 않습니다');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const newHash = await bcrypt.hash(new_password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
}

module.exports = { signup, login, refresh, changePassword };
