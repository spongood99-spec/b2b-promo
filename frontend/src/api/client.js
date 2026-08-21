import { useAuthStore } from '../stores/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let refreshPromise = null;

async function parseErrorAndThrow(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  // 서버가 { error: { code, message } } 포맷으로 준 한글 메시지는 그대로 신뢰한다
  // (project-principle.md 1장 5번). 코드/메시지가 없는 경우(서버 오류 포맷 이탈)에만
  // 영문 원본 대신 안전한 한글 문구로 대체한다.
  const message = body?.error?.message || '요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  const error = new Error(message);
  error.code = body?.error?.code;
  error.status = response.status;
  throw error;
}

export async function doRefresh() {
  let response;
  try {
    response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Network request failed:', err);
    const networkError = new Error('네트워크 연결을 확인해 주세요.');
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  if (!response.ok) {
    useAuthStore.getState().clearAuth();
    await parseErrorAndThrow(response);
  }

  const data = await response.json();
  useAuthStore.getState().setAuth(data.access_token, data.user);
}

async function request(path, options = {}, isRetry = false) {
  const { accessToken } = useAuthStore.getState();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    // fetch 자체가 실패(네트워크 끊김 등)하면 브라우저가 던지는 영문 기술 메시지 대신
    // 한글 문구로 감싼다. 원본은 콘솔에만 남겨 디버깅 정보를 보존한다.
    console.error('Network request failed:', err);
    const networkError = new Error('네트워크 연결을 확인해 주세요.');
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  if (response.status === 401 && !isRetry) {
    try {
      refreshPromise = refreshPromise ?? doRefresh();
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
    return request(path, options, true);
  }

  if (!response.ok) {
    await parseErrorAndThrow(response);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
