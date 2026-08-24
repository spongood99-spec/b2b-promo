const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorizedError());
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(unauthorizedError());
  }
}

function unauthorizedError() {
  const err = new Error('인증이 필요합니다');
  err.status = 401;
  err.code = 'UNAUTHORIZED';
  return err;
}

module.exports = auth;
