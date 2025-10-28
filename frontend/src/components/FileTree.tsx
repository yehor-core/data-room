import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDataRoomData } from '@/hooks';
import { DataRoomItem } from '@/components/DataRoomView';
import TreeNode from './TreeNode';

const FileTree: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { foldersQuery, filesQuery } = useDataRoomData({ dataRoomId: id });

  const items = useMemo(() => {
    const folders = foldersQuery.data?.data.folders || [];
    const files = filesQuery.data?.data || [];
    
    const combinedItems: DataRoomItem[] = [
      ...folders.map((folder: any) => ({ ...folder, type: 'folder' as const, size: null })),
      ...files.map((file: any) => ({ ...file, type: 'file' as const, size: Number(file.fileSize) || 0 })),
    ];
    
    return combinedItems.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
  }, [foldersQuery.data, filesQuery.data]);

  if (foldersQuery.isLoading || filesQuery.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {items.map(item => (
        <TreeNode
          key={item.id}
          item={item}
          level={0}
        />
      ))}
    </div>
  );
};

export default FileTree;
