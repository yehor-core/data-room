import React from 'react';
import { Folder, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Folder as FolderType } from '@/types';

interface FoldersGridProps {
  folders: FolderType[];
  dataRoomId: string;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => void;
  onMoreClick: (e: React.MouseEvent, item: { id: string; name: string; type: 'folder' | 'file' }) => void;
}

export const FoldersGrid: React.FC<FoldersGridProps> = ({
  folders,
  dataRoomId,
  onContextMenu,
  onMoreClick,
}) => {
  const navigate = useNavigate();

  if (folders.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Folders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <Card 
            key={folder.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(e, { id: folder.id, name: folder.name, type: 'folder' });
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div
                  className="flex items-center gap-3 flex-1"
                  onClick={() => navigate(`/data-rooms/${dataRoomId}/folders/${folder.id}`)}
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
                    onMoreClick(e, { id: folder.id, name: folder.name, type: 'folder' });
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
  );
};

