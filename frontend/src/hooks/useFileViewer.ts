import { useCallback } from 'react';

export const useFileViewer = () => {
  const handleFileView = useCallback(async (fileId: string) => {
    try {
      const url = `${process.env.REACT_APP_API_URL}/files/${fileId}/view`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error constructing file view URL:', error);
    }
  }, []);

  return { handleFileView };
};
