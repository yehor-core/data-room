import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, File as FileIcon } from 'lucide-react';
import { useDataRoomContents } from '@/data/dataRoom';
import type { Item } from '@/data/items';
import { LoadError } from './LoadError';
import { useDataRoomActions } from './DataRoomActions';
import { ItemMenu, useItemMenu } from './DataRoomView/ItemMenu';

const indent = (level: number) => ({ paddingLeft: `${level * 20}px` });

/** One level of the tree. It reads the same cache as the data room screen, so both always agree. */
const TreeLevel: React.FC<{ dataRoomId: string; folderId: string | null; level: number }> = ({
  dataRoomId,
  folderId,
  level,
}) => {
  const { items, isLoading, error, retry } = useDataRoomContents(dataRoomId, folderId);

  if (isLoading) return <div style={indent(level)}>Loading...</div>;
  if (error) {
    return (
      <div style={indent(level)}>
        <LoadError error={error} onRetry={retry} compact />
      </div>
    );
  }
  return (
    <ul>
      {items.map((item) => (
        <TreeNode key={item.id} dataRoomId={dataRoomId} item={item} level={level} />
      ))}
    </ul>
  );
};

const TreeNode: React.FC<{ dataRoomId: string; item: Item; level: number }> = ({
  dataRoomId,
  item,
  level,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openItem } = useDataRoomActions();
  const { menuProps, onContextMenu } = useItemMenu(item);
  const isFolder = item.type === 'folder';
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <li>
      <div
        className={`group flex items-center p-1 hover:bg-muted rounded ${item.pending ? 'opacity-60' : ''}`}
        style={indent(level)}
        onContextMenu={onContextMenu}
        aria-busy={item.pending || undefined}
      >
        {isFolder ? (
          <button
            type="button"
            className="flex-shrink-0"
            onClick={() => setIsOpen(!isOpen)}
            disabled={item.pending}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.name}`}
          >
            <Chevron className="h-4 w-4 mr-1" />
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}
        <button
          type="button"
          className="flex items-center flex-grow min-w-0 text-left"
          onClick={() => openItem(item)}
          disabled={item.pending}
        >
          {isFolder ? (
            <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
          ) : (
            <FileIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
        </button>
        <ItemMenu
          {...menuProps}
          className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        />
      </div>
      {isFolder && isOpen && (
        <TreeLevel dataRoomId={dataRoomId} folderId={item.id} level={level + 1} />
      )}
    </li>
  );
};

export const FileTree: React.FC<{ dataRoomId: string }> = ({ dataRoomId }) => (
  <nav aria-label="Folder tree">
    <TreeLevel dataRoomId={dataRoomId} folderId={null} level={0} />
  </nav>
);
