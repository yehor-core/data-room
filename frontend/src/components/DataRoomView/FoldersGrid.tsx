import React from 'react';
import { Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/Card';
import { DataRoomItem } from './columns';
import { ItemActions } from './ItemActions';

interface FoldersGridProps {
  folders: DataRoomItem[];
  dataRoomId: string;
  onRename: (item: DataRoomItem) => void;
  onDelete: (item: DataRoomItem) => void;
}

export const FoldersGrid: React.FC<FoldersGridProps> = ({
  folders,
  dataRoomId,
  onRename,
  onDelete,
}) => {
  const navigate = useNavigate();

  if (folders.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Folders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <Card
            key={folder.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div 
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/data-rooms/${dataRoomId}/folders/${folder.id}`)}
                >
                  <Folder className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{folder.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Modified {folder.updatedAt}
                    </p>
                  </div>
                </div>
                <ItemActions
                  item={folder}
                  onRename={() => onRename(folder)}
                  onDelete={() => onDelete(folder)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

