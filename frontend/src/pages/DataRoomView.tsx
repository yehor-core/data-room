import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardContent } from '@/components/ui/Card';
import { CreateFolderDialog } from '@/components/DataRoomView/CreateFolderDialog';
import { UploadFileDialog } from '@/components/DataRoomView/UploadFileDialog';
import { RenameDialog } from '@/components/DataRoomView/RenameDialog';
import { ContextMenu } from '@/components/DataRoomView/ContextMenu';
import { FoldersGrid } from '@/components/DataRoomView/FoldersGrid';
import { FilesGrid } from '@/components/DataRoomView/FilesGrid';
import { EmptyState } from '@/components/DataRoomView/EmptyState';
import { useDataRoomData, useDataRoomMutations } from '@/hooks';
import { 
  getCurrentFolderContents, 
  searchAllContent,
  handleFileView 
} from '@/utils/dataRoomHelpers';
import { toast } from '@/lib/toast';

export const DataRoomView: React.FC = () => {
  const { id, folderId } = useParams<{ id: string; folderId?: string }>();
  const navigate = useNavigate();
  
  // State management
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
  
  // Custom hooks
  const { 
    dataRoomQuery, 
    folderQuery, 
    foldersQuery, 
    filesQuery, 
    allFilesQuery,
    isLoading 
  } = useDataRoomData({ dataRoomId: id, folderId });
  
  const {
    createFolderMutation,
    deleteFolderMutation,
    deleteFileMutation,
    renameFolderMutation,
    renameFileMutation,
    uploadFileMutation,
  } = useDataRoomMutations({ dataRoomId: id, folderId });
  
  // Redirect if trying to access a temporary data room
  useEffect(() => {
    if (id?.startsWith('temp-')) {
      console.warn('⚠️ Attempted to access temporary data room, redirecting...');
      toast.error('This data room is still being created. Please wait and try again.');
      navigate('/data-rooms');
    }
  }, [id, navigate]);
  
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

  // Get current folder contents
  const { folders, files } = getCurrentFolderContents(
    folderId,
    folderQuery.data,
    foldersQuery.data
  );

  // Search across entire data room
  const searchResults = useMemo(() => 
    searchAllContent(
      debouncedSearch,
      folders,
      files,
      foldersQuery.data,
      allFilesQuery.data
    ),
    [debouncedSearch, folders, files, foldersQuery.data, allFilesQuery.data]
  );

  const { folders: filteredFolders, files: filteredFiles } = searchResults;

  // Event handlers
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }
    createFolderMutation.mutate(newFolderName, {
      onSuccess: () => {
        setIsCreateFolderDialogOpen(false);
        setNewFolderName('');
      }
    });
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile && uploadFileName.trim()) {
      let targetFolderId = folderId;
      
      if (!targetFolderId) {
        const rootFolders = foldersQuery.data?.data || [];
        if (rootFolders.length === 0) {
          toast.warning('Please create a folder first before uploading files');
          return;
        }
        targetFolderId = rootFolders[0].id;
      }
      
      if (targetFolderId) {
        uploadFileMutation.mutate({ file: selectedFile, name: uploadFileName, folderId: targetFolderId }, {
          onSuccess: () => {
            setIsUploadDialogOpen(false);
            setSelectedFile(null);
            setUploadFileName('');
          }
        });
      }
    }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameItem && newName.trim()) {
      if (renameItem.type === 'folder') {
        renameFolderMutation.mutate({ id: renameItem.id, name: newName }, {
          onSuccess: () => {
            setIsRenameDialogOpen(false);
            setRenameItem(null);
            setNewName('');
          }
        });
      } else {
        renameFileMutation.mutate({ id: renameItem.id, name: newName }, {
          onSuccess: () => {
            setIsRenameDialogOpen(false);
            setRenameItem(null);
            setNewName('');
          }
        });
      }
    }
  };

  const handleFolderClick = (folderId: string) => {
    navigate(`/data-rooms/${id}/folders/${folderId}`);
  };

  const handleFileClick = (fileId: string) => {
    handleFileView(fileId, allFilesQuery.data?.data || []);
  };

  const handleContextMenu = (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => {
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      item 
    });
  };

  const handleMoreClick = (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ 
      x: rect.left, 
      y: rect.bottom, 
      item 
    });
  };

  const handleDelete = (item: { id: string; name: string; type: 'folder' | 'file' }) => {
    const confirmMessage = item.type === 'folder' 
      ? 'Delete this folder and all its contents?' 
      : 'Delete this file?';
    
    if (window.confirm(confirmMessage)) {
      if (item.type === 'folder') {
        deleteFolderMutation.mutate(item.id);
      } else {
        deleteFileMutation.mutate(item.id);
      }
    }
    setContextMenu(null);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-4 md:py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                if (folderId) {
                  const currentFolder = folderQuery.data?.data;
                  if (currentFolder?.parentId) {
                    navigate(`/data-rooms/${id}/folders/${currentFolder.parentId}`);
                  } else {
                    navigate(`/data-rooms/${id}`);
                  }
                } else {
                  navigate('/');
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {folderId 
                  ? (folderQuery.data?.data?.parent?.name 
                      ? `Back to ${folderQuery.data.data.parent.name}` 
                      : 'Back to Data Room')
                  : 'Back to Data Rooms'}
              </span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {folderId ? folderQuery.data?.data?.name : dataRoomQuery.data?.data?.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {folderId ? `Folder in ${dataRoomQuery.data?.data?.name}` : 'Data Room'}
              </p>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
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
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateFolderDialogOpen(true)} size="sm" className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">Folder</span>
              </Button>
              {folderId && (
                <Button onClick={() => setIsUploadDialogOpen(true)} size="sm" className="flex-1 sm:flex-none">
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Upload File</span>
                  <span className="sm:hidden">Upload</span>
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Empty State */}
              {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                <EmptyState
                  isSearching={!!debouncedSearch.trim()}
                  searchQuery={debouncedSearch}
                  isInFolder={!!folderId}
                  onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
                  onUploadFile={folderId ? () => setIsUploadDialogOpen(true) : undefined}
                  onClearSearch={() => setSearchInput('')}
                />
              )}

              {/* Folders Grid */}
              <FoldersGrid
                folders={filteredFolders}
                dataRoomId={id!}
                onContextMenu={handleContextMenu}
                onMoreClick={handleMoreClick}
              />

              {/* Files Grid */}
              <FilesGrid
                files={filteredFiles}
                folders={foldersQuery.data?.data || []}
                isSearching={!!debouncedSearch.trim()}
                searchQuery={debouncedSearch}
                onContextMenu={handleContextMenu}
                onMoreClick={handleMoreClick}
              />
            </div>
          )}

          {/* Dialogs */}
          <CreateFolderDialog
            isOpen={isCreateFolderDialogOpen}
            onOpenChange={setIsCreateFolderDialogOpen}
            folderName={newFolderName}
            onFolderNameChange={setNewFolderName}
            onSubmit={handleCreateFolder}
            isPending={createFolderMutation.isPending}
          />

          <UploadFileDialog
            isOpen={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
            fileName={uploadFileName}
            onFileNameChange={setUploadFileName}
            onFileSelect={(file) => {
              setSelectedFile(file);
              setUploadFileName(file.name.replace('.pdf', ''));
            }}
            onSubmit={handleUpload}
            isPending={uploadFileMutation.isPending}
            selectedFile={selectedFile}
          />

          <RenameDialog
            isOpen={isRenameDialogOpen}
            onOpenChange={setIsRenameDialogOpen}
            itemType={renameItem?.type || null}
            newName={newName}
            onNewNameChange={setNewName}
            onSubmit={handleRename}
            isPending={renameFolderMutation.isPending || renameFileMutation.isPending}
          />

          {/* Context Menu */}
          {contextMenu && (
            <ContextMenu
              item={contextMenu.item}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onView={contextMenu.item.type === 'file' ? () => {
                handleFileClick(contextMenu.item.id);
                setContextMenu(null);
              } : undefined}
              onRename={() => {
                setRenameItem(contextMenu.item);
                setNewName(contextMenu.item.name);
                setIsRenameDialogOpen(true);
                setContextMenu(null);
              }}
              onDelete={() => handleDelete(contextMenu.item)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
