import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export function useChangeRequests(promotionId) {
  return useQuery({
    queryKey: ['changeRequests', promotionId],
    queryFn: () => apiClient.get(`/promotions/${promotionId}/change-requests`),
    enabled: !!promotionId,
  });
}

export function useCreateChangeRequest(promotionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content) => apiClient.post(`/promotions/${promotionId}/change-requests`, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeRequests', promotionId] }),
  });
}

export function useUpdateChangeRequestStatus(promotionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, apply_status }) => apiClient.patch(`/change-requests/${id}`, { apply_status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeRequests', promotionId] }),
  });
}
