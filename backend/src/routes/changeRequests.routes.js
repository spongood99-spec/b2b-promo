const express = require('express');
const requireRole = require('../middlewares/requireRole');
const ctrl = require('../controllers/changeRequests.controller');

const promotionScoped = express.Router({ mergeParams: true });
promotionScoped.post('/', requireRole('partner'), ctrl.create);
promotionScoped.get('/', ctrl.list);

const topLevel = express.Router();
topLevel.patch('/:id', requireRole('cj_freshway'), ctrl.update);

module.exports = { promotionScoped, topLevel };
