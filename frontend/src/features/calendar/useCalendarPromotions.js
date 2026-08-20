import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function useCalendarPromotions(from, to) {
  return useQuery({
    queryKey: ['promotions', 'calendar', from, to],
    queryFn: () => apiClient.get(`/promotions?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}
