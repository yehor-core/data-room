import type { QueryObserverResult } from '@tanstack/react-query';

/** The part every read hook returns besides its data: loading, the error that ended loading, and a retry. */
export const readStatus = ({
  isPending,
  error,
  refetch,
}: Pick<QueryObserverResult, 'isPending' | 'error' | 'refetch'>) => ({
  isLoading: isPending && !error,
  error,
  retry: () => void refetch(),
});
