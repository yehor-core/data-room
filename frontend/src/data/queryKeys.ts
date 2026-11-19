// The only place that knows cache keys. Not used outside the data module.
export const queryKeys = {
  dataRoomList: ['dataRooms', 'list'] as const,
  dataRoom: (dataRoomId: string) => ['dataRooms', 'room', dataRoomId] as const,
  contents: (dataRoomId: string, folderId: string | null) =>
    ['dataRooms', 'room', dataRoomId, 'contents', folderId] as const,
};
