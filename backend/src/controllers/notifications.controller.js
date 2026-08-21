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

module.exports = { list };
