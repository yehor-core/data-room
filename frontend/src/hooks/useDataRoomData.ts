import { useQuery } from '@tanstack/react-query';
import { ApiResponse, DataRoom } from '@/types';
import { api } from '@/lib/api';

interface UseDataRoomDataProps {
  dataRoomId?: string;
  folderId?: string;
}

/**
 * Custom hook for fetching data room related data
 */
export const useDataRoomData = ({ dataRoomId, folderId }: UseDataRoomDataProps) => {
  const isValidId = dataRoomId && !dataRoomId.startsWith('temp-');

  // Fetch data room
  const dataRoomQuery = useQuery<ApiResponse<DataRoom>>({
    queryKey: ['dataRoom', dataRoomId],
    queryFn: async () => {
      const response = await api.get(`/data-rooms/${dataRoomId}`);
      return response.data;
    },
    enabled: !!isValidId && !folderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch folder contents
  const folderQuery = useQuery({
    queryKey: ['folder', folderId],
    queryFn: async () => {
      const response = await api.get(`/folders/${folderId}/contents`);
      return response.data;
    },
    enabled: !!folderId && !!isValidId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch folders for data room
  const foldersQuery = useQuery({
    queryKey: ['folders', dataRoomId],
    queryFn: async () => {
      const response = await api.get(`/data-rooms/${dataRoomId}`);
      console.log('📁 Folders response:', response.data);
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch files for data room or folder (current view)
  const filesQuery = useQuery({
    queryKey: ['files', dataRoomId, folderId],
    queryFn: async () => {
      const params = folderId ? { folderId } : { dataRoomId };
      const response = await api.get('/files', { params });
      console.log('📄 Files response:', response.data);
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 1 * 60 * 1000, // 1 minute - files change more frequently
    gcTime: 3 * 60 * 1000, // 3 minutes cache
  });

  // Fetch ALL files from entire data room (for search and file tree)
  const allFilesQuery = useQuery({
    queryKey: ['allFiles', dataRoomId],
    queryFn: async () => {
      const response = await api.get('/files', { params: { dataRoomId } });
      console.log('📄 All files response:', response.data);
      return response.data;
    },
    enabled: !!isValidId,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
  });

  const isLoading = !folderId 
    ? (foldersQuery.isLoading || filesQuery.isLoading) 
    : (folderQuery.isLoading || filesQuery.isLoading);

  return {
    dataRoomQuery,
    folderQuery,
    foldersQuery,
    filesQuery,
    allFilesQuery,
    isLoading,
  };
};

