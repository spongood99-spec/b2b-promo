const ms = require('ms');
const authService = require('../services/auth.service');

const isProduction = process.env.NODE_ENV === 'production';

// 프론트/백엔드가 서로 다른 도메인(예: 각각 다른 *.vercel.app 서브도메인)에 배포되면
// 브라우저가 둘을 크로스사이트로 취급해 SameSite=Lax 쿠키를 fetch 요청에 실어 보내지
// 않는다. 크로스사이트에서도 전송되려면 SameSite=None(+Secure 필수)이 필요하다.
// 로컬 개발은 http라 Secure를 못 켜므로(SameSite=None은 Secure 없이는 브라우저가 거부)
// 그때는 Lax를 유지한다(로컬은 같은 origin이라 Lax로도 충분).
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  maxAge: ms(process.env.JWT_REFRESH_EXPIRES || '7d'),
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

async function changePassword(req, res, next) {
  try {
    await authService.changePassword({
      userId: req.user.id,
      current_password: req.body.current_password,
      new_password: req.body.new_password,
    });
    res.status(200).json({ message: '비밀번호가 변경되었습니다' });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  // path뿐 아니라 sameSite/secure/httpOnly도 로그인 때 실제로 심은 쿠키(REFRESH_COOKIE_OPTIONS)와
  // 동일해야 브라우저가 같은 쿠키로 인식해 지운다. 운영에서는 SameSite=None; Secure로 심었으므로
  // 이 속성 없이 clearCookie를 호출하면 크로스사이트 컨텍스트에서 삭제 지시가 무시되어
  // 로그아웃 후에도 refresh token이 계속 유효하게 남는다.
  res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
  res.status(200).json({ message: '로그아웃되었습니다' });
}

module.exports = { signup, login, refresh, changePassword, logout };
