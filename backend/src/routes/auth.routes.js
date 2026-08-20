const express = require('express');
const ctrl = require('../controllers/auth.controller');
const router = express.Router();
router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
module.exports = router;
