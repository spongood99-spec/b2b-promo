import { create } from 'zustand';
import { queryClient } from '../api/queryClient';

// 로그아웃 없이 다른 계정으로 재로그인하는 경우(같은 브라우저 세션), TanStack Query 캐시가
// 사용자별로 분리되어 있지 않아 이전 계정의 데이터가 잠깐 노출될 수 있다(알림 기능에서 실제 발견된 버그).
// 매 계정마다 쿼리 키를 전부 다르게 하는 대신, 인증 상태가 바뀔 때마다 캐시 전체를 비워
// 근본적으로 재발을 막는다.
export const useAuthStore = create((set, get) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => {
    // access token 갱신(새로고침, 401 재시도)은 같은 사용자로 계속 setAuth를 호출하므로
    // 매번 캐시를 비우면 정상적인 캐싱 이점이 사라진다. 실제로 다른 사용자로 바뀔 때만 비운다.
    const prevUser = get().user;
    if (prevUser && user && prevUser.id !== user.id) {
      queryClient.clear();
    }
    set({ accessToken, user });
  },
  clearAuth: () => {
    queryClient.clear();
    set({ accessToken: null, user: null });
  },
}));
