const express = require('express');
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/auth.controller');
const router = express.Router();
router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.patch('/password', auth, ctrl.changePassword);
module.exports = router;
