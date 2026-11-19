import React from 'react';
import { Folder, FileText } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { formatBytes, formatDate } from '@/lib/utils';
import { useDataRoomActions } from '@/components/DataRoomActions';
import type { Item } from '@/data/items';
import { ItemMenu, useItemMenu } from './ItemMenu';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const subtitle = (item: Item) =>
  item.type === 'folder'
    ? `${plural(item.childCount, 'folder')} · ${plural(item.fileCount, 'file')}`
    : `${item.size === undefined ? 'Unknown size' : formatBytes(item.size)} · ${formatDate(item.createdAt)}`;

const ItemCard: React.FC<{ item: Item }> = ({ item }) => {
  const { openItem } = useDataRoomActions();
  const { menuProps, onContextMenu } = useItemMenu(item);
  const Icon = item.type === 'folder' ? Folder : FileText;

  return (
    <Card
      className={item.pending ? 'opacity-60' : 'hover:shadow-md transition-shadow'}
      onContextMenu={onContextMenu}
      aria-busy={item.pending || undefined}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <button
            type="button"
            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer disabled:cursor-default"
            onClick={() => openItem(item)}
            disabled={item.pending}
          >
            <Icon
              className={`h-8 w-8 flex-shrink-0 ${item.type === 'folder' ? 'text-blue-500' : 'text-gray-500'}`}
            />
            <div className="min-w-0">
              <h3 className="font-medium truncate">{item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {item.pending ? 'Creating...' : subtitle(item)}
              </p>
            </div>
          </button>
          <ItemMenu {...menuProps} />
        </div>
      </CardContent>
    </Card>
  );
};

const Section: React.FC<{ title: string; items: Item[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <section aria-label={title}>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );

export const ItemsGrid: React.FC<{ items: Item[] }> = ({ items }) => (
  <div className="space-y-6">
    <Section title="Folders" items={items.filter((item) => item.type === 'folder')} />
    <Section title="Files" items={items.filter((item) => item.type === 'file')} />
  </div>
);
