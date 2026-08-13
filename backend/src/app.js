const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
