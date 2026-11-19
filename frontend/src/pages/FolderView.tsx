import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/DataTable';
import {
  DataRoomLayout,
  FoldersGrid,
  FilesGrid,
  DataRoomItem,
  getColumns,
  EmptyState,
  CreateFolderDialog,
  UploadFileDialog,
  RenameDialog,
} from '@/components/DataRoomView';
import {
  useDataRoomData,
  useDebounce,
  useFileViewer,
  useCreateFolder,
  useFileUpload,
  useItemRename,
  useDataRoomMutations,
} from '@/hooks';
import { fileTreeEvents } from '@/lib/events';

type ViewMode = 'grid' | 'list';

export function FolderView() {
  const { id, folderId } = useParams<{ id: string; folderId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    folderQuery,
    foldersQuery,
    filesQuery,
  } = useDataRoomData({ dataRoomId: id, folderId });

  const { handleFileView } = useFileViewer();
  const createFolder = useCreateFolder(id, folderId);
  const uploadFile = useFileUpload(id, folderId);
  const renameItem = useItemRename(id, folderId);
  const { deleteFolderMutation, deleteFileMutation } = useDataRoomMutations({ dataRoomId: id, folderId });
  
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const filteredFolders = useMemo(
    () =>
      folderQuery?.data?.data.children?.filter((folder: any) =>
        folder.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [folderQuery?.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      folderQuery?.data?.data.files?.filter((file: any) =>
        file.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [folderQuery?.data, debouncedSearch]
  );

  const items = useMemo(() => {
    const combinedItems: DataRoomItem[] = [
      ...filteredFolders.map((folder: any) => ({ ...folder, type: 'folder' as const, size: null })),
      ...filteredFiles.map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })),
    ];
    return combinedItems.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, filteredFiles]);

  const handleFileClick = (item: DataRoomItem) => handleFileView(item.id);

  const { open: openRename } = renameItem;
  const handleRename = useCallback(
    (item: DataRoomItem) => openRename({ id: item.id, name: item.name, type: item.type }),
    [openRename]
  );

  useEffect(() => {
    const unsubscribeRename = fileTreeEvents.subscribe('renameItem', handleRename);
    const unsubscribeDelete = fileTreeEvents.subscribe('deleteItem', setItemToDelete);

    return () => {
      unsubscribeRename();
      unsubscribeDelete();
    };
  }, [handleRename]);

  const handleBackClick = useCallback(() => {
    const parentId = folderQuery?.data?.data.parentId;
    if (parentId) {
      navigate(`/data-rooms/${id}/folders/${parentId}`);
    } else {
      navigate(`/data-rooms/${id}`);
    }
  }, [navigate, id, folderQuery?.data?.data]);

  const isLoading = folderQuery?.isLoading || foldersQuery.isLoading || filesQuery.isLoading;

  const onConfirmDelete = (confirm: boolean) => {
    if (confirm && itemToDelete) {
      if (itemToDelete.type === 'folder') {
        deleteFolderMutation.mutate(itemToDelete.id);
      } else {
        deleteFileMutation.mutate(itemToDelete.id);
      }
    }
    setItemToDelete(null);
  };
  
  return (
    <>
      <DataRoomLayout
        title={folderQuery?.data?.data.name || 'Folder'}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        onCreateFolder={createFolder.open}
        onUpload={uploadFile.open}
        itemToDelete={itemToDelete}
        onConfirmDelete={onConfirmDelete}
        onBackClick={handleBackClick}
      >
        {items.length === 0 ? (
          <EmptyState 
            isSearching={!!debouncedSearch.trim()} 
            searchQuery={debouncedSearch}
            isInFolder={true}
            onCreateFolder={createFolder.open}
            onUploadFile={uploadFile.open}
            onClearSearch={() => setSearchQuery('')}
          />
        ) : viewMode === 'grid' ? (
          <>
            <FoldersGrid
              folders={items.filter((item): item is Extract<DataRoomItem, { type: 'folder' }> => item.type === 'folder')}
              dataRoomId={id!}
              onRename={handleRename}
              onDelete={setItemToDelete}
            />
            <FilesGrid
              files={items.filter((item): item is Extract<DataRoomItem, { type: 'file' }> => item.type === 'file')}
              onView={handleFileClick}
              onRename={handleRename}
              onDelete={setItemToDelete}
            />
          </>
        ) : (
          <DataTable columns={getColumns(handleFileClick, handleRename, setItemToDelete)} data={items} />
        )}
      </DataRoomLayout>

      <CreateFolderDialog
        isOpen={createFolder.isOpen}
        onOpenChange={(open) => !open && createFolder.close()}
        folderName={createFolder.folderName}
        onFolderNameChange={createFolder.setFolderName}
        onSubmit={createFolder.handleSubmit}
        isPending={createFolder.isPending}
      />
      <UploadFileDialog
        isOpen={uploadFile.isOpen}
        onOpenChange={(open) => !open && uploadFile.close()}
        selectedFile={uploadFile.selectedFile}
        fileName={uploadFile.fileName}
        onFileNameChange={uploadFile.setFileName}
        onFileSelect={uploadFile.handleFileSelect}
        onSubmit={uploadFile.handleSubmit}
        isPending={uploadFile.isPending}
      />
      <RenameDialog
        isOpen={renameItem.isOpen}
        onOpenChange={(open) => !open && renameItem.close()}
        itemType={renameItem.item?.type || null}
        newName={renameItem.newName}
        onNewNameChange={renameItem.setNewName}
        onSubmit={renameItem.handleSubmit}
        isPending={renameItem.isPending}
      />
    </>
  );
}

