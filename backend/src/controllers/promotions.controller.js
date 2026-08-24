const promotionsService = require('../services/promotions.service');

async function create(req, res, next) {
  try {
    const promotion = await promotionsService.createPromotion({
      proposerId: req.user.id,
      ...req.body,
    });
    res.status(201).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const promotions = await promotionsService.listPromotions({
      userId: req.user.id,
      role: req.user.role,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
    });
    res.status(200).json(promotions);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const promotion = await promotionsService.getPromotionById({
      id: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const promotion = await promotionsService.approvePromotion({
      id: req.params.id,
      reviewerId: req.user.id,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const promotion = await promotionsService.rejectPromotion({
      id: req.params.id,
      reviewerId: req.user.id,
      reject_reason: req.body.reject_reason,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const promotion = await promotionsService.cancelPromotion({
      id: req.params.id,
      reviewerId: req.user.id,
      cancel_reason: req.body.cancel_reason,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function updateAndApprove(req, res, next) {
  try {
    const promotion = await promotionsService.updateAndApprovePromotion({
      id: req.params.id,
      reviewerId: req.user.id,
      ...req.body,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function reopen(req, res, next) {
  try {
    const promotion = await promotionsService.reopenPromotion({ id: req.params.id });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

async function resubmit(req, res, next) {
  try {
    const promotion = await promotionsService.resubmitPromotion({
      id: req.params.id,
      proposerId: req.user.id,
      ...req.body,
    });
    res.status(200).json(promotion);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, approve, reject, cancel, updateAndApprove, reopen, resubmit };
