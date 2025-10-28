import React from 'react';
import { FileText, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { File as FileType, Folder as FolderType } from '@/types';
import { formatDate, formatBytes } from '@/lib/utils';

interface FilesGridProps {
  files: FileType[];
  folders: FolderType[];
  isSearching: boolean;
  searchQuery: string;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => void;
  onMoreClick: (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => void;
}

export const FilesGrid: React.FC<FilesGridProps> = ({
  files,
  folders,
  isSearching,
  searchQuery,
  onContextMenu,
  onMoreClick,
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Files</h2>
      <div className="grid grid-cols-1 gap-2">
        {files.map((file) => {
          const fileFolder = folders.find((f) => f.id === file.folderId);
          return (
            <Card 
              key={file.id} 
              className="hover:shadow-md transition-shadow"
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(e, { id: file.id, name: file.name, type: 'file' });
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
                        {isSearching && searchQuery.trim() && fileFolder && (
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
                      onMoreClick(e, { id: file.id, name: file.name, type: 'file' });
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
  );
};

