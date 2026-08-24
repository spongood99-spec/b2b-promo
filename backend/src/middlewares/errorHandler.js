function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` },
  });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);

  // 명시적으로 던진 에러(err.status가 있는 경우)만 code/message를 그대로 보여준다.
  if (err.status) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // 그 외(DB 제약 위반, 타입 캐스팅 실패 등 애플리케이션이 예상하지 못한 예외)는
  // 원본 PostgreSQL 에러코드/메시지가 내부 스키마·DB 종류를 노출할 수 있어
  // 고정 code/message로 대체하고 상세는 로그로만 남긴다.
  // 예외: 22P02(잘못된 입력 형식, 예: uuid가 아닌 id)는 클라이언트 실수이므로 400으로 분류한다.
  if (err.code === '22P02') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다' } });
    return;
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
  });
}

module.exports = { notFoundHandler, errorHandler };
