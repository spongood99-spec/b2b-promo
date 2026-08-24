const express = require('express');
const ctrl = require('../controllers/notifications.controller');

const router = express.Router();
router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
