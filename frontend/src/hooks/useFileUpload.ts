import { useState } from 'react';
import { toast } from '../lib/toast';
import { FILE_TOO_LARGE_MESSAGE, MAX_UPLOAD_BYTES } from '../lib/errorMessages';
import { useDataRoomMutations } from './useDataRoomMutations';

/**
 * Hook to manage file upload workflow
 * Handles dialog state, file selection, and upload submission
 */
export const useFileUpload = (dataRoomId?: string, folderId?: string) => {
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
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(FILE_TOO_LARGE_MESSAGE);
      return;
    }
    setSelectedFile(file);
    setFileName(file.name.replace('.pdf', ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileName.trim()) {
      toast.error('Please select a file and enter a name');
      return;
    }

    uploadFileMutation.mutate(
      { file: selectedFile, name: fileName, folderId: folderId || null },
      {
        onSuccess: () => {
          close();
        },
      }
    );
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

