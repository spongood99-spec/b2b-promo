import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useToastStore } from '../../stores/toastStore';

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: (payload) => apiClient.post('/promotions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      addToast('프로모션이 등록되었습니다.');
    },
  });
}

function invalidateBoth(queryClient, id) {
  queryClient.invalidateQueries({ queryKey: ['promotions'] });
  queryClient.invalidateQueries({ queryKey: ['promotion', id] });
}

export function useApprovePromotion(id) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: () => apiClient.patch(`/promotions/${id}/approve`),
    onSuccess: () => {
      invalidateBoth(queryClient, id);
      addToast('프로모션이 승인되었습니다.');
    },
  });
}

export function useRejectPromotion(id) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: (reject_reason) => apiClient.patch(`/promotions/${id}/reject`, { reject_reason }),
    onSuccess: () => {
      invalidateBoth(queryClient, id);
      addToast('프로모션이 반려되었습니다.');
    },
  });
}

export function useCancelPromotion(id) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: (cancel_reason) => apiClient.patch(`/promotions/${id}/cancel`, { cancel_reason }),
    onSuccess: () => {
      invalidateBoth(queryClient, id);
      addToast('프로모션이 취소되었습니다.');
    },
  });
}

export function useUpdateAndApprovePromotion(id) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: (payload) => apiClient.patch(`/promotions/${id}`, payload),
    onSuccess: () => {
      invalidateBoth(queryClient, id);
      addToast('수정 내용이 반영되어 승인되었습니다.');
    },
  });
}

export function useReopenPromotion(id) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: () => apiClient.patch(`/promotions/${id}/reopen`),
    onSuccess: () => {
      invalidateBoth(queryClient, id);
      addToast('프로모션이 재오픈되었습니다.');
    },
  });
}
