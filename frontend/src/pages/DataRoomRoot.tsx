import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DataTable } from '@/components/DataTable';
import {
  DataRoomLayout,
  FoldersGrid,
  FilesGrid,
  DataRoomItem,
  getColumns,
} from '@/components/DataRoomView';
import { useDataRoomData, useDebounce, useDisclosure, useFileViewer } from '@/hooks';
import { EmptyState } from '@/components/DataRoomView/EmptyState';
import {
  CreateFolderDialog,
  UploadFileDialog,
  RenameDialog,
} from '@/components/Dialogs';

type ViewMode = 'grid' | 'list';

export function DataRoomRoot() {
  const { id } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    dataRoomQuery,
    foldersQuery,
    filesQuery,
    createFolder,
    uploadFile,
    renameItem,
    deleteItem,
  } = useDataRoomData(id);

  const { handleFileView } = useFileViewer();
  const [itemToDelete, setItemToDelete] = useState<DataRoomItem | null>(null);

  const handleDelete = useCallback((item: DataRoomItem) => {
    setItemToDelete(item);
  }, []);

  const filteredFolders = useMemo(
    () =>
      foldersQuery.data?.data.filter((folder) =>
        folder.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [foldersQuery.data, debouncedSearch]
  );

  const filteredFiles = useMemo(
    () =>
      filesQuery.data?.data.filter((file) =>
        file.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) || [],
    [filesQuery.data, debouncedSearch]
  );
  
  const items = useMemo(() => {
    const combinedItems: DataRoomItem[] = [
      ...filteredFolders.map((folder) => ({ ...folder, type: 'folder' as const, size: null })),
      ...filteredFiles.map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })),
    ];
    return combinedItems.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
  }, [filteredFolders, filteredFiles]);

  const handleFileClick = useCallback((item: DataRoomItem) => {
    if (item.type === 'file') {
      handleFileView(item.id);
    }
  }, [handleFileView]);

  const {
    isOpen: isRenameOpen,
    open: openRename,
    close: closeRename,
    data: itemToRename,
  } = useDisclosure<DataRoomItem>();

  const handleRename = useCallback((item: DataRoomItem) => {
    openRename(item);
  }, [openRename]);

  const columns = useMemo(
    () => getColumns(handleFileClick, handleRename, handleDelete),
    [handleFileClick, handleRename, handleDelete]
  );

  const isLoading = dataRoomQuery.isLoading || foldersQuery.isLoading || filesQuery.isLoading;

  const onConfirmDelete = (confirm: boolean) => {
    if (confirm && itemToDelete) {
      deleteItem.mutate(itemToDelete);
    }
    setItemToDelete(null);
  };

  return (
    <>
      <DataRoomLayout
        title={dataRoomQuery.data?.data.name || 'Data Room'}
        items={items}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        onCreateFolder={() => createFolder.open()}
        onUpload={() => uploadFile.open()}
        itemToDelete={itemToDelete}
        onConfirmDelete={onConfirmDelete}
      >
        {items.length === 0 ? (
          <EmptyState isSearching={!!debouncedSearch.trim()} onCreateFolder={() => createFolder.open()} />
        ) : viewMode === 'grid' ? (
          <>
            <FoldersGrid
              folders={items.filter((item): item is Extract<DataRoomItem, { type: 'folder' }> => item.type === 'folder')}
              onRename={handleRename}
              onDelete={handleDelete}
            />
            <FilesGrid
              files={items.filter((item): item is Extract<DataRoomItem, { type: 'file' }> => item.type === 'file')}
              folders={foldersQuery.data?.data || []}
              isSearching={!!debouncedSearch.trim()}
              searchQuery={debouncedSearch}
              onView={handleFileClick}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </>
        ) : (
          <DataTable columns={columns} data={items} />
        )}
      </DataRoomLayout>

      <CreateFolderDialog
        isOpen={createFolder.isOpen}
        onClose={createFolder.close}
        onSubmit={createFolder.mutate}
        isLoading={createFolder.isPending}
      />
      <UploadFileDialog
        isOpen={uploadFile.isOpen}
        onClose={uploadFile.close}
        onSubmit={uploadFile.mutate}
        isLoading={uploadFile.isPending}
        dataRoomId={id!}
      />
      <RenameDialog
        isOpen={isRenameOpen}
        onClose={closeRename}
        onSubmit={renameItem.mutate}
        isLoading={renameItem.isPending}
        item={itemToRename}
      />
    </>
  );
}

