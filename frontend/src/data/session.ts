// Client data module for the signed-in session: which access token the API client sends, the user's profile, and
// forgetting every cached response when the session ends.
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/types';
import { api, setAuthToken } from './api';

export function useSessionData() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      /** Requests carry this session's token from now on. Without a session, nothing cached is kept for the next user. */
      sessionChanged(accessToken: string | null) {
        setAuthToken(accessToken);
        if (!accessToken) queryClient.clear();
      },
      /** The signed-in user's profile (`GET /api/auth/me`). The first request also creates the account. */
      fetchProfile: () => api.get<User>('/auth/me'),
    }),
    [queryClient],
  );
}
