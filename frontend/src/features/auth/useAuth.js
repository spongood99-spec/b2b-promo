import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export function useSignup() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body) => apiClient.post('/auth/signup', body),
    onSuccess: () => navigate('/login'),
  });
}

export function useLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (body) => apiClient.post('/auth/login', body),
    onSuccess: (data) => {
      useAuthStore.getState().setAuth(data.access_token, data.user);
      navigate('/');
    },
  });
}
