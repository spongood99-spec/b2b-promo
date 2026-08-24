const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../../docs/swagger.json');
const pool = require('./db/pool');
const auth = require('./middlewares/auth');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth.routes');
const promotionsRoutes = require('./routes/promotions.routes');
const { promotionScoped: changeRequestsScoped, topLevel: changeRequestsTop } = require('./routes/changeRequests.routes');
const notificationsRoutes = require('./routes/notifications.routes');

// 필수 환경변수가 비어있으면(예: 배포 시 설정 누락) 첫 요청에서야 불명확하게 실패하는 대신
// 즉시 기동을 중단해 배포 실수를 바로 드러낸다.
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`필수 환경변수가 설정되지 않았습니다: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();

// CSP는 끈다 — 개발 모드에서만 마운트되는 /api-docs(swagger-ui-express)가 인라인 스크립트를
// 써서 기본 CSP와 충돌한다. X-Frame-Options/X-Content-Type-Options/HSTS 등 나머지 방어 헤더는 유지.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.get('/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRoutes);
app.use('/promotions', promotionsRoutes);
app.use('/promotions/:id/change-requests', auth, changeRequestsScoped);
app.use('/change-requests', auth, changeRequestsTop);
app.use('/notifications', auth, notificationsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
