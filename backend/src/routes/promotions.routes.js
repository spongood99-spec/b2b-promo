const express = require('express');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const ctrl = require('../controllers/promotions.controller');

const router = express.Router();
// 이 라우터는 인증을 내부(router.use(auth))에서 건다. change-requests/notifications
// 라우터는 app.js에서 마운트할 때 외부(app.use(path, auth, router))로 건다 — 두 방식이
// 혼재하니 새 라우터를 추가할 때 반드시 한쪽 방식으로 인증이 걸려 있는지 확인할 것.
router.use(auth);
router.post('/', requireRole('partner'), ctrl.create);
router.get('/', ctrl.list);
router.get('/stats', ctrl.stats);
router.get('/:id', ctrl.getById);
router.patch('/:id/approve', requireRole('cj_freshway'), ctrl.approve);
router.patch('/:id/reject', requireRole('cj_freshway'), ctrl.reject);
router.patch('/:id/cancel', requireRole('cj_freshway'), ctrl.cancel);
router.patch('/:id', requireRole('cj_freshway'), ctrl.updateAndApprove);
router.patch('/:id/reopen', requireRole('cj_freshway'), ctrl.reopen);
router.patch('/:id/resubmit', requireRole('partner'), ctrl.resubmit);

module.exports = router;
