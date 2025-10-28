import { useState } from 'react';
import { toast } from '../lib/toast';
import { useDataRoomMutations } from './useDataRoomMutations';

/**
 * Hook to manage file upload workflow
 * Handles dialog state, file selection, and upload submission
 */
export const useFileUpload = (dataRoomId?: string, folderId?: string, folders?: any[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const { uploadFileMutation } = useDataRoomMutations({ dataRoomId, folderId });

  const open = () => setIsOpen(true);
  
  const close = () => {
    setIsOpen(false);
    setSelectedFile(null);
    setFileName('');
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setFileName(file.name.replace('.pdf', ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileName.trim()) {
      toast.error('Please select a file and enter a name');
      return;
    }

    let targetFolderId = folderId;
    
    // If not in a folder, try to use the first folder
    if (!targetFolderId) {
      const rootFolders = folders || [];
      if (rootFolders.length === 0) {
        toast.warning('Please create a folder first before uploading files');
        return;
      }
      targetFolderId = rootFolders[0].id;
    }
    
    if (targetFolderId) {
      uploadFileMutation.mutate(
        { file: selectedFile, name: fileName, folderId: targetFolderId },
        {
          onSuccess: () => {
            close();
          }
        }
      );
    }
  };

  return {
    isOpen,
    selectedFile,
    fileName,
    setFileName,
    open,
    close,
    handleFileSelect,
    handleSubmit,
    isPending: uploadFileMutation.isPending,
  };
};

