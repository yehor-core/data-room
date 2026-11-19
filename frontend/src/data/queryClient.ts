import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

// A failed request is retried once only when trying again can help: not for "not found", conflicts and the like.
const RETRYABLE = new Set(['NETWORK', 'TIMEOUT', 'INTERNAL']);

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < 1 && error instanceof ApiError && RETRYABLE.has(error.code),
        staleTime: 60 * 1000,
      },
    },
  });
