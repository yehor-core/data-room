import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errorMessages';

type Patch<TData> = (data: TData) => TData;

let pendingIds = 0;

/** What every optimistically created record has: a temporary id, its trimmed name, timestamps and the pending flag. */
export function pendingRecord(kind: string, name: string) {
  const timestamp = new Date().toISOString();
  return {
    id: `pending-${kind}-${++pendingIds}`,
    name: name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    pending: true,
  };
}

interface OptimisticMutation<TData, TVars, TResult> {
  /** Every cached query under this key holds TData; all of them are patched and restored. */
  scope: QueryKey;
  mutationFn: (vars: TVars) => Promise<TResult>;
  /** Applied before the request; undone if it fails. */
  optimistic?: (vars: TVars) => Patch<TData>;
  /** Applied when the server confirms, before the refetch completes. */
  confirmed?: (result: TResult, vars: TVars) => Patch<TData>;
  successMessage: (vars: TVars) => string;
  /** Called when the server confirms, e.g. to drop caches of something deleted. */
  onConfirmed?: (vars: TVars) => void;
  /**
   * Which of the scope's cached queries show something the change affects: only those are refetched when it
   * settles. Without it, all of them are.
   */
  affects?: (vars: TVars) => (data: TData) => boolean;
  /** Another cache that shows derived data (e.g. counts) of this change, refetched when it settles. */
  alsoInvalidate?: (vars: TVars) => QueryKey | null;
}

/**
 * Cancel, snapshot, patch, roll back on error with one toast, invalidate when settled: written once here.
 * Returns a function that resolves to true when the server accepted the change. It never rejects.
 */
export function useOptimisticMutation<TData, TVars, TResult>({
  scope,
  mutationFn,
  optimistic,
  confirmed,
  successMessage,
  onConfirmed,
  affects,
  alsoInvalidate,
}: OptimisticMutation<TData, TVars, TResult>) {
  const queryClient = useQueryClient();
  const patchAll = (patch: Patch<TData>) =>
    queryClient.setQueriesData<TData>({ queryKey: scope }, (data) => data && patch(data));

  const { mutateAsync } = useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: scope });
      const snapshot = queryClient.getQueriesData<TData>({ queryKey: scope });
      if (optimistic) patchAll(optimistic(vars));
      return { snapshot };
    },
    onSuccess: (result, vars) => {
      if (confirmed) patchAll(confirmed(result, vars));
      onConfirmed?.(vars);
      toast.success(successMessage(vars));
    },
    onError: (error, _vars, context) => {
      context?.snapshot.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
      toast.error(getErrorMessage(error));
    },
    onSettled: (_result, _error, vars) => {
      const affected = affects?.(vars);
      const other = alsoInvalidate?.(vars);
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: scope,
          predicate: affected && (({ state }) => !!state.data && affected(state.data as TData)),
        }),
        other && queryClient.invalidateQueries({ queryKey: other }),
      ]);
    },
  });

  return useCallback(
    (vars: TVars) =>
      mutateAsync(vars).then(
        () => true,
        () => false,
      ),
    [mutateAsync],
  );
}
