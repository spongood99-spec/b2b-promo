const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/auth.controller');
const router = express.Router();

// ponytail: 인스턴스 메모리 기반 — Vercel 서버리스에서는 인스턴스마다 카운터가 분리돼 완벽하지 않지만,
// 무차별 대입에 대한 최소한의 방어선으로는 충분하다. 트래픽이 커지면 Redis 등 공유 스토어로 교체.
// node --test로 실행 중이면(테스트 스위트가 짧은 시간에 다수 signup/login을 반복) 제한을 걸지 않는다.
const isTestRun = process.execArgv.some((arg) => arg.startsWith('--test'));
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestRun,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' } },
});

router.post('/signup', authRateLimit, ctrl.signup);
router.post('/login', authRateLimit, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.patch('/password', auth, ctrl.changePassword);
module.exports = router;
