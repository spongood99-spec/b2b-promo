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
  const message = body?.error?.message || 'Request failed';
  const error = new Error(message);
  error.code = body?.error?.code;
  error.status = response.status;
  throw error;
}

export async function doRefresh() {
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

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

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

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
