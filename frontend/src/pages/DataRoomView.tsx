import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Folder, FileText, Trash2, Edit, Upload, Search, Copy, MoreVertical } from 'lucide-react';
import { DataRoom, Folder as FolderType, File as FileType, ApiResponse } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { FileTree } from '../components/FileTree';
import { formatDate, formatBytes } from '../lib/utils';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES, LOADING_MESSAGES } from '../lib/errorMessages';


export const DataRoomView: React.FC = () => {
  const { id, folderId } = useParams<{ id: string; folderId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameItem, setRenameItem] = useState<{ id: string; name: string; type: 'folder' | 'file' } | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: { id: string; name: string; type: 'folder' | 'file' } } | null>(null);
  
  // Debounce search input (wait 300ms after last keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      console.log('🔍 Search updated:', searchInput);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Fetch data room
  const { data: dataRoomData } = useQuery<ApiResponse<DataRoom>>({
    queryKey: ['dataRoom', id],
    queryFn: async () => {
      const response = await api.get(`/data-rooms`, { params: { id } });
      return response.data;
    },
    enabled: !!id && !folderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch folder contents
  const { data: folderData } = useQuery({
    queryKey: ['folder', folderId],
    queryFn: async () => {
      const response = await api.get(`/folders`, { params: { id: folderId } });
      return response.data;
    },
    enabled: !!folderId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch folders for data room
  const { data: foldersData } = useQuery({
    queryKey: ['folders', id],
    queryFn: async () => {
      const response = await api.get(`/data-rooms?id=${id}&action=folders`);
      console.log('📁 Folders response:', response.data);
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Fetch files for data room or folder
  const { data: filesData } = useQuery({
    queryKey: ['files', id, folderId],
    queryFn: async () => {
      const response = await api.get(folderId ? `/folders?id=${folderId}&action=files` : `/data-rooms?id=${id}&action=files`);
      console.log('📄 Files response:', response.data);
      return response.data;
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute - files change more frequently
    gcTime: 3 * 60 * 1000, // 3 minutes cache
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/folders', {
        name,
        dataRoomId: id,
        parentId: folderId || null,
      });
      return response.data.data;
    },
    onSuccess: () => {
      setIsCreateFolderDialogOpen(false);
      setNewFolderName('');
      // Invalidate relevant queries
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['folders', id] });
      }
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderIdToDelete: string) => {
      console.log('🗑️ Deleting folder:', folderIdToDelete);
      try {
        const response = await api.delete(`/folders?id=${folderIdToDelete}`);
        console.log('✅ Delete response:', response);
        return { id: folderIdToDelete };
      } catch (error: any) {
        console.error('❌ Delete folder API error:', {
          error,
          code: error.code,
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DELETED);
      // Invalidate ALL related queries to refresh file tree
      queryClient.invalidateQueries({ queryKey: ['dataRoom', id] });
      queryClient.invalidateQueries({ queryKey: ['folders', id] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      }
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      console.log('🗑️ Deleting file:', fileId);
      try {
        const response = await api.delete(`/files?id=${fileId}`);
        console.log('✅ Delete file response:', response);
        return { id: fileId };
      } catch (error: any) {
        console.error('❌ Delete file API error:', {
          error,
          code: error.code,
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_DELETED);
      // Invalidate ALL related queries to refresh file tree
      queryClient.invalidateQueries({ queryKey: ['dataRoom', id] });
      queryClient.invalidateQueries({ queryKey: ['folders', id] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
        queryClient.invalidateQueries({ queryKey: ['files', id, folderId] });
      }
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api.patch(`/folders?id=${id}`, { name });
      return response.data.data;
    },
    onSuccess: () => {
      setIsRenameDialogOpen(false);
      setRenameItem(null);
      setNewName('');
      // Invalidate relevant queries
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['folders', id] });
      }
    },
  });

  const renameFileMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      console.log('✏️ Renaming file:', { id, name });
      try {
        const response = await api.patch(`/files?id=${id}`, { name });
        console.log('✅ Rename file response:', response);
        return response.data.data;
      } catch (error: any) {
        console.error('❌ Rename file API error:', {
          error,
          code: error.code,
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw error;
      }
    },
    onSuccess: () => {
      setIsRenameDialogOpen(false);
      setRenameItem(null);
      setNewName('');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files', id, folderId] });
    },
    onError: (error: any) => {
      console.error('❌ Rename file error:', error);
      let message = 'Failed to rename file';
      
      if (error.code === 'ERR_NETWORK') {
        message = 'Network error. Please check your connection and try again.';
      } else if (error.response?.status === 401) {
        message = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 404) {
        message = 'File not found. It may have been deleted.';
      } else if (error.response?.status === 403) {
        message = 'You do not have permission to rename this file.';
      } else if (error.response?.status === 409) {
        message = 'A file with this name already exists.';
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      } else if (error.message) {
        message = error.message;
      }
      
      toast.error(getErrorMessage(error));
    },
  });

  // Duplicate folder mutation
  const duplicateFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const response = await api.post(`/folders?id=${folderId}&action=duplicate`);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FOLDER_DUPLICATED);
      queryClient.invalidateQueries({ queryKey: ['dataRoom', id] });
      queryClient.invalidateQueries({ queryKey: ['folders', id] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
      }
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Duplicate file mutation
  const duplicateFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await api.post(`/files?id=${fileId}&action=duplicate`);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.FILE_DUPLICATED);
      queryClient.invalidateQueries({ queryKey: ['dataRoom', id] });
      queryClient.invalidateQueries({ queryKey: ['folders', id] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
        queryClient.invalidateQueries({ queryKey: ['files', id, folderId] });
      }
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });


  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, name, folderId }: { file: File; name: string; folderId: string }) => {
      // Check file size (Vercel Pro limit: 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB in bytes
      if (file.size && file.size > maxSize) {
        throw new Error(`File size exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB. Please compress the file or upload a smaller file.`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('folderId', folderId);
      
      const response = await api.post('/files?action=upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data.data;
    },
    onSuccess: () => {
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadFileName('');
      toast.success(SUCCESS_MESSAGES.FILE_UPLOADED);
      // Invalidate ALL related queries to refresh file tree
      queryClient.invalidateQueries({ queryKey: ['dataRoom', id] });
      queryClient.invalidateQueries({ queryKey: ['folders', id] });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder', folderId] });
        queryClient.invalidateQueries({ queryKey: ['files', id, folderId] });
      }
    },
    onError: (error: any) => {
      console.error('File upload error:', error);
      const status = error.response?.status;
      const responseData = error.response?.data;
      
      let message = 'File upload failed';
      
      if (status === 413) {
        message = 'File too large! Vercel Pro has a 100MB limit.';
      } else if (status === 409) {
        // Handle duplicate file error with better messaging
        message = responseData?.message || responseData?.error || 'A file with this name already exists in this folder.';
      } else if (status === 401) {
        message = 'Authentication failed. Please try logging out and back in.';
      } else if (status === 500) {
        message = 'Server error occurred. Please try again.';
      } else if (responseData?.message) {
        message = responseData.message;
      } else if (responseData?.error) {
        message = responseData.error;
      } else if (error.message) {
        message = error.message;
      }
      
      toast.error(getErrorMessage(error));
    },
  });

  // Get current folder's contents
  const getCurrentFolderContents = () => {
    if (folderId) {
      // Show contents of specific folder
      return {
        folders: folderData?.data?.children || [],
        files: folderData?.data?.files || []
      };
    } else {
      // Show root level contents (only folders with no parent, NO FILES at root level)
      const allFolders = Array.isArray(foldersData?.data) 
        ? foldersData.data 
        : (foldersData?.data?.folders || []);
      
      // Filter to only show root-level folders (no parentId)
      const rootFolders = allFolders.filter((folder: any) => !folder.parentId);
      
      return {
        folders: rootFolders,
        files: [] // No files at data room root level
      };
    }
  };

  // Get all folders and files for FileTree (needed for proper tree structure)
  const getAllFoldersAndFiles = () => {
    const allFolders = Array.isArray(foldersData?.data) 
      ? foldersData.data 
      : (foldersData?.data?.folders || []);
    
    const allFiles = Array.isArray(filesData?.data) 
      ? filesData.data 
      : (filesData?.data?.files || []);
    
    return {
      folders: allFolders,
      files: allFiles
    };
  };

  const { folders, files } = getCurrentFolderContents();
  const isLoading = !folderId ? (foldersData?.isLoading || filesData?.isLoading) : (folderData?.isLoading || filesData?.isLoading);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile && uploadFileName.trim()) {
      // Upload to current folder (or create a default folder if at root level)
      let targetFolderId = folderId;
      
      if (!targetFolderId) {
        // At root level - create a default folder if none exists
        const rootFolders = foldersData?.data || [];
        if (rootFolders.length === 0) {
          toast.warning('Please create a folder first before uploading files');
          return;
        }
        targetFolderId = rootFolders[0].id;
      }
      
      if (targetFolderId) {
        uploadFileMutation.mutate({ file: selectedFile, name: uploadFileName, folderId: targetFolderId });
      }
    }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameItem && newName.trim()) {
      if (renameItem.type === 'folder') {
        renameFolderMutation.mutate({ id: renameItem.id, name: newName });
      } else {
        renameFileMutation.mutate({ id: renameItem.id, name: newName });
      }
    }
  };

  // Search across entire data room (using debounced search)
  const searchAllContent = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return { folders, files };
    }

    const query = debouncedSearch.toLowerCase();
    
    // Get ALL folders from data room (root level)
    const allFolders = Array.isArray(foldersData?.data) 
      ? foldersData.data 
      : (foldersData?.data?.folders || []);
    
    // Recursively search through all folders
    const searchInFolders = (foldersList: any[]): any[] => {
      let results: any[] = [];
      foldersList.forEach((folder: any) => {
        if (folder.name.toLowerCase().includes(query)) {
          results.push(folder);
        }
        if (folder.children && folder.children.length > 0) {
          results = results.concat(searchInFolders(folder.children));
        }
      });
      return results;
    };
    
    // Search in current view AND all subfolders
    const matchingFolders = searchInFolders(allFolders);
    
    // For files, search only in current folder (would need API endpoint for global file search)
    const matchingFiles = files.filter((file: FileType) => 
      file.name.toLowerCase().includes(query)
    );

    return { folders: matchingFolders, files: matchingFiles };
  }, [debouncedSearch, folders, files, foldersData]);

  const { folders: filteredFolders, files: filteredFiles } = searchAllContent();

  const handleFolderClick = (folderId: string) => {
    navigate(`/data-rooms/${id}/folders/${folderId}`);
  };

  const handleFileClick = (fileId: string) => {
    console.log('🔍 Attempting to view file:', fileId);
    
    // Search in all files, not just current folder's files
    const allFiles = getAllFoldersAndFiles().files;
    const file = allFiles.find((f: FileType) => f.id === fileId);
    
    if (!file) {
      console.error('❌ File not found in any files list:', fileId);
      toast.error('File not found. Please refresh the page.');
      return;
    }

    // Map database fields to expected frontend fields
    const blobUrl = file.filePath || file.blobUrl;
    const fileType = file.mimeType || file.fileType;
    const size = file.fileSize || file.size;

    console.log('📄 File details:', {
      id: file.id,
      name: file.name,
      blobUrl,
      fileType,
      size,
      originalFile: file
    });

    // Open file in new tab using the blobUrl from the database
    if (blobUrl) {
      try {
        if (fileType === 'application/pdf') {
          // Open PDF in new tab with proper viewer
          const pdfWindow = window.open('', '_blank');
          if (pdfWindow) {
            pdfWindow.document.write(`
              <html>
                <head>
                  <title>${file.name}</title>
                  <style>
                    body { margin: 0; padding: 0; background: #f5f5f5; }
                    .container { width: 100%; height: 100vh; display: flex; flex-direction: column; }
                    .header { background: white; padding: 10px; border-bottom: 1px solid #ddd; }
                    .viewer { flex: 1; background: white; }
                    iframe { width: 100%; height: 100%; border: none; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h3>${file.name}</h3>
                    </div>
                    <div class="viewer">
                      <iframe src="${blobUrl}" type="application/pdf"></iframe>
                    </div>
                  </div>
                </body>
              </html>
            `);
            pdfWindow.document.close();
            console.log('✅ PDF opened successfully');
          } else {
            console.error('❌ Failed to open PDF window - popup blocked?');
            toast.error('Failed to open PDF. Please check if popups are blocked.');
          }
        } else {
          // For other file types, create a download link
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = file.name;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('✅ File download initiated');
        }
      } catch (error) {
        console.error('❌ Error opening file:', error);
        toast.error(`Error opening file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.error('❌ File has no blobUrl:', file);
      toast.error(`File "${file.name}" not found. It may have been deleted. Please re-upload.`);
    }
  };

  return (
    <div className="flex h-screen">
      {/* File Tree Sidebar */}
      <FileTree
        folders={getAllFoldersAndFiles().folders}
        files={getAllFoldersAndFiles().files}
        onFolderClick={handleFolderClick}
        onFileClick={handleFileClick}
        currentPath={folderId}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => {
            if (folderId) {
              // If we're in a folder, check if it has a parent
              const currentFolder = folderData?.data;
              if (currentFolder?.parentId) {
                // Go to parent folder
                navigate(`/data-rooms/${id}/folders/${currentFolder.parentId}`);
              } else {
                // Go to data room root
                navigate(`/data-rooms/${id}`);
              }
            } else {
              // If we're at data room root, go to data rooms list
              navigate('/');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {folderId 
            ? (folderData?.data?.parent?.name 
                ? `Back to ${folderData.data.parent.name}` 
                : 'Back to Data Room')
            : 'Back to Data Rooms'}
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {folderId ? folderData?.data?.name : dataRoomData?.data?.name}
          </h1>
          <p className="text-muted-foreground">
            {folderId ? `Folder in ${dataRoomData?.data?.name}` : 'Data Room'}
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button onClick={() => setIsCreateFolderDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
        {folderId && (
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        )}
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Empty State */}
          {filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Folder className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No files or folders yet</h3>
                <p className="text-muted-foreground mb-6">
                  {folderId 
                    ? 'Upload files or create folders to get started'
                    : 'Create folders to organize your documents'}
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setIsCreateFolderDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Folder
                  </Button>
                  {folderId && (
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload File
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {filteredFolders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Folders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFolders.map((folder: FolderType) => (
                  <Card 
                    key={folder.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ 
                        x: e.clientX, 
                        y: e.clientY, 
                        item: { id: folder.id, name: folder.name, type: 'folder' }
                      });
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div
                          className="flex items-center gap-3 flex-1"
                          onClick={() => navigate(`/data-rooms/${id}/folders/${folder.id}`)}
                        >
                          <Folder className="h-8 w-8 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{folder.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {folder._count?.files || 0} files · {folder._count?.children || 0} folders
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ 
                              x: e.currentTarget.getBoundingClientRect().left, 
                              y: e.currentTarget.getBoundingClientRect().bottom, 
                              item: { id: folder.id, name: folder.name, type: 'folder' }
                            });
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredFiles.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Files</h2>
              <div className="grid grid-cols-1 gap-2">
                    {filteredFiles.map((file: FileType) => {
                      const fileFolder = (foldersData?.data || []).find((f: FolderType) => f.id === file.folderId);
                      return (
                    <Card 
                      key={file.id} 
                      className="hover:shadow-md transition-shadow"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ 
                          x: e.clientX, 
                          y: e.clientY, 
                          item: { id: file.id, name: file.name, type: 'file' }
                        });
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-6 w-6 text-red-500" />
                            <div className="min-w-0">
                              <h3 className="font-medium truncate">{file.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {file.fileSize ? formatBytes(file.fileSize) : (file.size ? formatBytes(file.size) : 'Unknown size')} · {formatDate(file.createdAt)}
                                {debouncedSearch.trim() && fileFolder && (
                                  <span className="ml-2 text-blue-600">in {fileFolder.name}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ 
                              x: e.currentTarget.getBoundingClientRect().left, 
                              y: e.currentTarget.getBoundingClientRect().bottom, 
                              item: { id: file.id, name: file.name, type: 'file' }
                            });
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4">
            <Input
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createFolderMutation.isPending}>
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload PDF File</DialogTitle>
            <DialogDescription>Select a PDF file to upload</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setUploadFileName(file.name.replace('.pdf', ''));
                  }
                }}
              />
            </div>
            <Input
              placeholder="File Name"
              value={uploadFileName}
              onChange={(e) => setUploadFileName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploadFileMutation.isPending || !selectedFile}>
                {uploadFileMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameItem?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>Enter a new name</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <Input
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={renameFolderMutation.isPending || renameFileMutation.isPending}>
                {(renameFolderMutation.isPending || renameFileMutation.isPending) ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 min-w-[120px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item.type === 'file' && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                handleFileClick(contextMenu.item.id);
                setContextMenu(null);
              }}
            >
              <FileText className="h-4 w-4" />
              View
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              setRenameItem(contextMenu.item);
              setNewName(contextMenu.item.name);
              setIsRenameDialogOpen(true);
              setContextMenu(null);
            }}
          >
            <Edit className="h-4 w-4" />
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              if (contextMenu.item.type === 'folder') {
                duplicateFolderMutation.mutate(contextMenu.item.id);
              } else {
                duplicateFileMutation.mutate(contextMenu.item.id);
              }
              setContextMenu(null);
            }}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
            onClick={() => {
              const confirmMessage = contextMenu.item.type === 'folder' 
                ? 'Delete this folder and all its contents?' 
                : 'Delete this file?';
              if (window.confirm(confirmMessage)) {
                if (contextMenu.item.type === 'folder') {
                  deleteFolderMutation.mutate(contextMenu.item.id);
                } else {
                  deleteFileMutation.mutate(contextMenu.item.id);
                }
              }
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

