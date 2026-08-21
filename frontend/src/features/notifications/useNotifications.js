import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function useNotifications(limit = 5) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => apiClient.get(`/notifications?limit=${limit}`),
    refetchInterval: 30000,
  });
}
