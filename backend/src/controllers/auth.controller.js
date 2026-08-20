const authService = require('../services/auth.service');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/auth/refresh',
};

async function signup(req, res, next) {
  try {
    const user = await authService.signup(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ access_token: accessToken, user });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { accessToken, user } = await authService.refresh(req.cookies.refresh_token);
    res.status(200).json({ access_token: accessToken, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh };
