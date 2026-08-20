const changeRequestsService = require('../services/changeRequests.service');

async function create(req, res, next) {
  try {
    const changeRequest = await changeRequestsService.createChangeRequest({
      promotionId: req.params.id,
      requesterId: req.user.id,
      content: req.body.content,
    });
    res.status(201).json(changeRequest);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const changeRequests = await changeRequestsService.listChangeRequestsByPromotion({
      promotionId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });
    res.status(200).json(changeRequests);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const changeRequest = await changeRequestsService.updateChangeRequestStatus({
      id: req.params.id,
      apply_status: req.body.apply_status,
    });
    res.status(200).json(changeRequest);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, update };
