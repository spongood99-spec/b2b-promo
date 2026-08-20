// 이 미들웨어는 항상 auth 미들웨어 뒤에 마운트되는 것을 전제로 함
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      const err = new Error('인증이 필요합니다');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      return next(err);
    }
    if (!allowedRoles.includes(req.user.role)) {
      const err = new Error('접근 권한이 없습니다');
      err.status = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }
    next();
  };
}

module.exports = requireRole;
