import React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { File as FileType, Folder as FolderType } from '../../types';
import { formatDate, formatBytes } from '../../lib/utils';
import { DataRoomItem } from './columns';
import { ItemActions } from './ItemActions';

interface FilesGridProps {
  files: DataRoomItem[];
  folders: FolderType[];
  isSearching: boolean;
  searchQuery: string;
  onView: (item: DataRoomItem) => void;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
}

export const FilesGrid: React.FC<FilesGridProps> = ({
  files,
  folders,
  isSearching,
  searchQuery,
  onView,
  onRename,
  onDelete,
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Files</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div 
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onView(file)}
                >
                  <FileText className="h-8 w-8 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {file.size ? formatBytes(file.size) : 'Unknown size'} · {formatDate(file.createdAt)}
                      {isSearching && searchQuery.trim() && file.type === 'file' && folders.find(f => f.id === file.folderId) && (
                        <span className="ml-2 text-blue-600">in {folders.find(f => f.id === file.folderId)?.name}</span>
                      )}
                    </p>
                  </div>
                </div>
                <ItemActions
                  item={file}
                  onView={() => onView(file)}
                  onRename={() => onRename(file)}
                  onDelete={() => onDelete(file)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

