import { useSessionPermissions } from '@24bid/api-client';
import { hasPermission } from '@24bid/shared';
import { useAuthStore } from './auth-store';

export function useBuyerPermissions() {
  const userId = useAuthStore((state) => state.session?.userId);
  const query = useSessionPermissions(userId);
  const permissions = query.isError ? [] : query.data?.data.permissions ?? [];
  return { query, can: (permission: string) => hasPermission(permissions, permission) };
}
