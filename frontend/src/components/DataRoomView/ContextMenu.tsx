import React from 'react';
import { FileText, Edit, Trash2 } from 'lucide-react';

interface ContextMenuItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
}

interface ContextMenuProps {
  item: ContextMenuItem;
  position: { x: number; y: number };
  onView?: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  item,
  position,
  onView,
  onRename,
  onDelete,
}) => {
  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 min-w-[120px]"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {item.type === 'file' && onView && (
        <button
          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
          onClick={onView}
        >
          <FileText className="h-4 w-4" />
          View
        </button>
      )}
      <button
        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
        onClick={onRename}
      >
        <Edit className="h-4 w-4" />
        Rename
      </button>
      <button
        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
};

