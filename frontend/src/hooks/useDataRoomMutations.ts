import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES, LOADING_MESSAGES } from '../lib/errorMessages';

interface UseDataRoomMutationsProps {
  dataRoomId?: string;
  folderId?: string;
}

/**
 * Custom hook for data room mutations (create, update, delete)
 */
export const useDataRoomMutations = ({ dataRoomId, folderId }: UseDataRoomMutationsProps) => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['dataRoom', dataRoomId] });
    queryClient.invalidateQueries({ queryKey: ['folders', dataRoomId] });
    queryClient.invalidateQueries({ queryKey: ['allFiles', dataRoomId] });
    if (folderId) {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      queryClient.invalidateQueries({ queryKey: ['files', dataRoomId, folderId] });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/folders', {
        name,
        dataRoomId,
        parentId: folderId || null,
      });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_CREATED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderIdToDelete: string) => {
      try {
        const response = await api.delete(`/folders/${folderIdToDelete}`);
        return { id: folderIdToDelete };
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DELETED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      try {
        const response = await api.delete(`/files/${fileId}`);
        return { id: fileId };
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_DELETED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put(`/folders/${id}`, { name });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_RENAMED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.put(`/files/${id}`, { name });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('File renamed successfully');
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, name, folderId }: { file: File; name: string; folderId: string }) => {
      const toastId = toast.loading(LOADING_MESSAGES.UPLOADING_FILE);
      
      try {
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        if (file.size && file.size > maxSize) {
          throw new Error(`File size exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Please compress the file or upload a smaller file.`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('folderId', folderId);
        
        const response = await api.post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        toast.dismiss(toastId);
        return response.data.data;
      } catch (error) {
        toast.dismiss(toastId);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_UPLOADED);
      invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  return {
    createFolderMutation,
    deleteFolderMutation,
    deleteFileMutation,
    renameFolderMutation,
    renameFileMutation,
    uploadFileMutation,
  };
};

