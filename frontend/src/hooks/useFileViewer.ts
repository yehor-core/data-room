import { isAxiosError } from 'axios';
import { useCallback } from 'react';
import { getFileUrl } from '@/lib/api';
import { toast } from '@/lib/toast';

export const useFileViewer = () => {
  const handleFileView = useCallback(async (fileId: string) => {
    try {
      const response = await getFileUrl(fileId);
      if (response.request.responseURL) {
        window.open(response.request.responseURL, '_blank');
      } else {
        toast.error('Could not get file view URL.');
      }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        toast.error('You are not authorized to view this file.');
      } else {
        toast.error('Failed to open file. Please try again.');
      }
    }
  }, []);

  return { handleFileView };
};
