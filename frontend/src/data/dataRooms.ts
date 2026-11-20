// Client data module for the list of the user's data rooms.
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataRoom } from '@/types';
import { SUCCESS_MESSAGES } from '@/lib/errorMessages';
import { api } from './api';
import { queryKeys } from './queryKeys';
import { pendingRecord, useOptimisticMutation } from './optimistic';
import { readStatus } from './readStatus';
import { contentsQuery } from './dataRoom';

type CachedDataRoom = DataRoom & { pending?: boolean };

export function useDataRooms() {
  const { data, ...query } = useQuery({
    queryKey: queryKeys.dataRoomList,
    queryFn: () => api.get<CachedDataRoom[]>('/data-rooms'),
  });
  return { dataRooms: data ?? [], ...readStatus(query) };
}

export function useDataRoomListMutations() {
  const queryClient = useQueryClient();
  const list = { scope: queryKeys.dataRoomList };

  const createDataRoom = useOptimisticMutation<CachedDataRoom[], string, DataRoom>({
    ...list,
    mutationFn: (name) => api.post<DataRoom>('/data-rooms', { name }),
    optimistic: (name) => (dataRooms) => [
      { ...pendingRecord('data-room', name), ownerId: '', _count: { folders: 0, files: 0 } },
      ...dataRooms,
    ],
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
