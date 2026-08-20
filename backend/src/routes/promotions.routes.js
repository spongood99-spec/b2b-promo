const express = require('express');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const ctrl = require('../controllers/promotions.controller');

const router = express.Router();
router.use(auth);
router.post('/', requireRole('partner'), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.patch('/:id/approve', requireRole('cj_freshway'), ctrl.approve);
router.patch('/:id/reject', requireRole('cj_freshway'), ctrl.reject);
router.patch('/:id/cancel', requireRole('cj_freshway'), ctrl.cancel);
router.patch('/:id', requireRole('cj_freshway'), ctrl.updateAndApprove);
router.patch('/:id/reopen', requireRole('cj_freshway'), ctrl.reopen);

module.exports = router;
