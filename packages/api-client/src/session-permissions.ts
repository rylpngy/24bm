import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';

export function useSessionPermissions(userId?: string) {
  return useQuery({
    queryKey: ['/api/v1/auth/permissions', userId],
    queryFn: () => customInstance<{ data: { permissions: string[] } }>({
      url: '/api/v1/auth/permissions', method: 'GET',
    }),
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: false,
  });
}
