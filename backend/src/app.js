const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db/pool');
const auth = require('./middlewares/auth');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth.routes');
const promotionsRoutes = require('./routes/promotions.routes');
const { promotionScoped: changeRequestsScoped, topLevel: changeRequestsTop } = require('./routes/changeRequests.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.get('/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

app.use('/auth', authRoutes);
app.use('/promotions', promotionsRoutes);
app.use('/promotions/:id/change-requests', auth, changeRequestsScoped);
app.use('/change-requests', auth, changeRequestsTop);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
