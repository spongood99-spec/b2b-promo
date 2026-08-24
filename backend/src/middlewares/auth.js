const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorizedError());
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    // access/refresh 시크릿이 운영에서 우연히 같은 값이더라도 refresh token을 Authorization
    // 헤더에 넣어 access token처럼 쓸 수 없도록 토큰 종류를 명시적으로 구분한다.
    if (payload.type !== 'access') {
      return next(unauthorizedError());
    }
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
