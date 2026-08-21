import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function usePromotions(status, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['promotions', status, page, limit],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);
      return apiClient.get(`/promotions?${params.toString()}`);
    },
  });
}

export function usePromotion(id) {
  return useQuery({
    queryKey: ['promotion', id],
    queryFn: () => apiClient.get(`/promotions/${id}`),
    enabled: !!id,
  });
}
