function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` },
  });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  // 명시적으로 던진 에러(err.status가 있는 경우)만 메시지를 그대로 보여준다.
  // 그 외(DB 제약 위반, 타입 캐스팅 실패 등 처리되지 않은 예외)는 원본 메시지가
  // 내부 스키마/구조를 노출할 수 있어 고정 문구로 대체하고 상세는 로그로만 남긴다.
  const message = err.status ? err.message : '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  res.status(status).json({ error: { code, message } });
}

module.exports = { notFoundHandler, errorHandler };
