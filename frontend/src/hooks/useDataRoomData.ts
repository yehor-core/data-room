import { useQuery } from '@tanstack/react-query';
import { ApiResponse, DataRoom, FolderWithChildren } from '../types';
import { api } from '../lib/api';

interface UseDataRoomDataProps {
  dataRoomId?: string;
  folderId?: string;
}

type DataRoomContents = DataRoom & {
  folders: FolderWithChildren[];
  files: File[];
};

/**
 * Custom hook for fetching data room and folder contents in a consolidated manner.
 */
export const useDataRoomData = ({ dataRoomId, folderId }: UseDataRoomDataProps) => {
  const isValidId = dataRoomId && !dataRoomId.startsWith('temp-');

  const queryKey = folderId ? ['folder', folderId] : ['dataRoom', dataRoomId];
  
  const queryFn = async () => {
    const url = folderId 
      ? `/folders/${folderId}/contents` 
      : `/data-rooms/${dataRoomId}`;
    const response = await api.get(url);
    return response.data;
  };

  const { data, isLoading, isError, error } = useQuery<ApiResponse<DataRoomContents | any>>({
    queryKey,
    queryFn,
    enabled: !!isValidId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,   // 5 minutes cache
  });

  // Fetch ALL files from entire data room (for search and file tree)
  // This is kept separate as it serves a different purpose and we don't want to load it on every view.
  const allFilesQuery = useQuery({
    queryKey: ['allFiles', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/files', { params: { dataRoomId } });
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 5 * 60 * 1000, // 5 minutes - this data is less likely to change frequently
    gcTime: 10 * 60 * 1000,  // 10 minutes cache
  });

  return {
    data: data?.data,
    isLoading,
    isError,
    error,
    allFilesQuery,
  };
};

