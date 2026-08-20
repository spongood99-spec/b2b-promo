import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function usePromotions(status) {
  return useQuery({
    queryKey: ['promotions', status],
    queryFn: () => apiClient.get(`/promotions${status ? `?status=${status}` : ''}`),
  });
}

export function usePromotion(id) {
  return useQuery({
    queryKey: ['promotion', id],
    queryFn: () => apiClient.get(`/promotions/${id}`),
    enabled: !!id,
  });
}
