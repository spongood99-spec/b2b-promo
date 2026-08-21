import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export function useNotifications(limit = 5) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    // 계정 전환 시(로그아웃 없이 재로그인) 다른 사용자의 알림이 캐시에서 잠깐 노출되는 것을 막기 위해
    // userId를 쿼리 키에 포함한다 — 계정이 바뀌면 캐시 미스로 처리되어 이전 사용자의 데이터를 보여주지 않는다.
    queryKey: ['notifications', userId, limit],
    queryFn: () => apiClient.get(`/notifications?limit=${limit}`),
    enabled: !!userId,
    refetchInterval: 30000,
  });
}
