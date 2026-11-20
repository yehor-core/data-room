import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { LoadError } from '@/components/LoadError';
import { useDataRoomActions } from '@/components/DataRoomActions';
import { Breadcrumb } from '@/components/DataRoomView/Breadcrumb';
import { EmptyState } from '@/components/DataRoomView/EmptyState';
import { ItemsGrid } from '@/components/DataRoomView/ItemsGrid';
import { ItemsTable } from '@/components/DataRoomView/ItemsTable';
import { SearchAndActions } from '@/components/DataRoomView/SearchAndActions';
import { useDataRoomContents } from '@/data/dataRoom';
import { filterItems } from '@/data/items';
import { useDebounce } from '@/hooks/useDebounce';
import { levelPath } from '@/lib/paths';

type ViewMode = 'grid' | 'list';

/** The data room root and every Folder: one screen, the Folder id is optional. */
export function DataRoomPage() {
  const { id, folderId } = useParams<{ id: string; folderId?: string }>();
  // A new level starts with an empty search.
  return <DataRoomScreen key={folderId ?? 'root'} dataRoomId={id!} folderId={folderId ?? null} />;
}

const DataRoomScreen: React.FC<{ dataRoomId: string; folderId: string | null }> = ({
  dataRoomId,
  folderId,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const actions = useDataRoomActions();
  const { items, folder, breadcrumb, dataRoomName, isLoading, error, retry } = useDataRoomContents(
    dataRoomId,
    folderId,
  );

  const visibleItems = filterItems(items, debouncedSearch);

  const goBack = () => navigate(levelPath(dataRoomId, folder?.parentId ?? null));

  let content: React.ReactNode;
  if (isLoading) {
    content = <p>Loading...</p>;
  } else if (error) {
    content = <LoadError error={error} onRetry={retry} />;
  } else if (visibleItems.length === 0) {
    content = (
      <EmptyState
        searchQuery={debouncedSearch}
        onCreateFolder={actions.startCreateFolder}
        onUploadFile={actions.startUpload}
        onClearSearch={() => setSearchQuery('')}
      />
    );
  } else if (viewMode === 'grid') {
    content = <ItemsGrid items={visibleItems} />;
  } else {
    content = <ItemsTable items={visibleItems} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="container mx-auto px-4 py-4 md:py-6 border-b">
        <Header
          title={folder?.name ?? dataRoomName ?? 'Data Room'}
          onBackClick={folderId ? goBack : undefined}
        />
        {dataRoomName && (
          <Breadcrumb dataRoomId={dataRoomId} dataRoomName={dataRoomName} trail={breadcrumb} />
        )}
        <SearchAndActions
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onUploadFile={actions.startUpload}
          onCreateFolder={actions.startCreateFolder}
        />
      </div>

      <div className="flex-1">
        <div className="container mx-auto px-4 py-6">{content}</div>
      </div>
    </div>
  );
};
