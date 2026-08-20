import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.post('/promotions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });
}

function invalidateBoth(queryClient, id) {
  queryClient.invalidateQueries({ queryKey: ['promotions'] });
  queryClient.invalidateQueries({ queryKey: ['promotion', id] });
}

export function useApprovePromotion(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch(`/promotions/${id}/approve`),
    onSuccess: () => invalidateBoth(queryClient, id),
  });
}

export function useRejectPromotion(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reject_reason) => apiClient.patch(`/promotions/${id}/reject`, { reject_reason }),
    onSuccess: () => invalidateBoth(queryClient, id),
  });
}

export function useCancelPromotion(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cancel_reason) => apiClient.patch(`/promotions/${id}/cancel`, { cancel_reason }),
    onSuccess: () => invalidateBoth(queryClient, id),
  });
}

export function useUpdateAndApprovePromotion(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => apiClient.patch(`/promotions/${id}`, payload),
    onSuccess: () => invalidateBoth(queryClient, id),
  });
}
