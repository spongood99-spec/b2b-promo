import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useToastStore } from '../../stores/toastStore';

export function useChangeRequests(promotionId) {
  return useQuery({
    queryKey: ['changeRequests', promotionId],
    queryFn: () => apiClient.get(`/promotions/${promotionId}/change-requests`),
    enabled: !!promotionId,
  });
}

export function useCreateChangeRequest(promotionId) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: (content) => apiClient.post(`/promotions/${promotionId}/change-requests`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeRequests', promotionId] });
      addToast('변경요청이 등록되었습니다.');
    },
  });
}

const APPLY_STATUS_TOAST = { applied: '변경요청이 반영완료되었습니다.', rejected: '변경요청이 반영거부되었습니다.' };

export function useUpdateChangeRequestStatus(promotionId) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: ({ id, apply_status }) => apiClient.patch(`/change-requests/${id}`, { apply_status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['changeRequests', promotionId] });
      addToast(APPLY_STATUS_TOAST[variables.apply_status] ?? '변경요청 상태가 갱신되었습니다.');
    },
  });
}
