/** The data room screen for one level: the data room root when folderId is null, otherwise that Folder. */
export const levelPath = (dataRoomId: string, folderId: string | null = null) =>
  `/data-rooms/${dataRoomId}${folderId ? `/folders/${folderId}` : ''}`;
