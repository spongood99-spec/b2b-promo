const notificationsService = require('../services/notifications.service');

async function list(req, res, next) {
  try {
    const notifications = await notificationsService.listNotifications({
      userId: req.user.id,
      limit: req.query.limit,
    });
    res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    const count = await notificationsService.countUnread({ userId: req.user.id });
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    await notificationsService.markAsRead({ id: req.params.id, userId: req.user.id });
    res.status(200).json({ message: '읽음으로 처리되었습니다' });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await notificationsService.markAllAsRead({ userId: req.user.id });
    res.status(200).json({ message: '모두 읽음으로 처리되었습니다' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, unreadCount, markRead, markAllRead };
