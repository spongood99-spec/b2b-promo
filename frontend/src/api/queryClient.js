import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx는 재시도해도 절대 성공하지 않으므로(잘못된 id, 권한 없음 등) 곧바로 에러 처리한다.
      retry: (failureCount, error) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});
