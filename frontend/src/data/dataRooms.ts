// Client data module for the list of the user's data rooms.
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataRoom } from '@/types';
import { SUCCESS_MESSAGES } from '@/lib/errorMessages';
import { api } from './api';
import { queryKeys } from './queryKeys';
import { useOptimisticMutation } from './optimistic';
import { contentsQuery } from './dataRoom';

type CachedDataRoom = DataRoom & { pending?: boolean };

export function useDataRooms() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.dataRoomList,
    queryFn: () => api.get<CachedDataRoom[]>('/data-rooms'),
  });
  return {
    dataRooms: data ?? [],
    isLoading: isPending && !error,
    error,
    retry: () => void refetch(),
  };
}

let pendingIds = 0;

export function useDataRoomListMutations() {
  const queryClient = useQueryClient();
  const list = { scope: queryKeys.dataRoomList };

  const createDataRoom = useOptimisticMutation<CachedDataRoom[], string, DataRoom>({
    ...list,
    mutationFn: (name) => api.post<DataRoom>('/data-rooms', { name }),
    optimistic: (name) => (dataRooms) => {
      const timestamp = new Date().toISOString();
      const dataRoom = {
        id: `pending-data-room-${++pendingIds}`,
        name: name.trim(),
        ownerId: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        _count: { folders: 0, files: 0 },
        pending: true,
      };
      return [dataRoom, ...dataRooms];
    },
    successMessage: () => SUCCESS_MESSAGES.DATA_ROOM_CREATED,
  });

  const deleteDataRoom = useOptimisticMutation<CachedDataRoom[], string, void>({
    ...list,
    mutationFn: (id) => api.delete(`/data-rooms/${id}`),
    optimistic: (id) => (dataRooms) => dataRooms.filter((dataRoom) => dataRoom.id !== id),
    onConfirmed: (id) => queryClient.removeQueries({ queryKey: queryKeys.dataRoom(id) }),
    successMessage: () => SUCCESS_MESSAGES.DATA_ROOM_DELETED,
  });

  return { createDataRoom, deleteDataRoom };
}

/** Starts loading a data room's root level, e.g. while the pointer is over its card. */
export function usePrefetchDataRoom() {
  const queryClient = useQueryClient();
  return useCallback(
    (dataRoomId: string) => void queryClient.prefetchQuery(contentsQuery(dataRoomId, null)),
    [queryClient],
  );
}
