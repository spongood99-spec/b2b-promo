function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` },
  });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  res.status(status).json({ error: { code, message: err.message } });
}

module.exports = { notFoundHandler, errorHandler };
