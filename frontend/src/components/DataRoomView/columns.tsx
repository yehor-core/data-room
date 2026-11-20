import { ColumnDef, HeaderContext } from '@tanstack/react-table';
import { ArrowUpDown, Folder, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatBytes, formatDate } from '@/lib/utils';
import { useDataRoomActions } from '@/components/DataRoomActions';
import type { Item } from '@/data/items';

const sortableHeader =
  (label: string) =>
  ({ column }: HeaderContext<Item, unknown>) => (
    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

const NameCell: React.FC<{ item: Item }> = ({ item }) => {
  const { openItem } = useDataRoomActions();
  const Icon = item.type === 'folder' ? Folder : FileIcon;
  return (
    <button
      type="button"
      className="flex items-center gap-2 text-left disabled:cursor-default"
      onClick={() => openItem(item)}
      disabled={item.pending}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{item.name}</span>
    </button>
  );
};

export const columns: ColumnDef<Item>[] = [
  {
    accessorKey: 'name',
    // The same order as everywhere else (case-insensitive), not the table's default code-point order.
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
    header: sortableHeader('Name'),
    cell: ({ row }) => <NameCell item={row.original} />,
  },
  {
    accessorKey: 'updatedAt',
    header: sortableHeader('Date Modified'),
    cell: ({ row }) => <div>{formatDate(row.original.updatedAt)}</div>,
  },
  {
    id: 'size',
    accessorFn: (item) => (item.type === 'file' ? item.size : undefined),
    sortUndefined: 'last',
    header: sortableHeader('File Size'),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="text-right">
          {item.type === 'file' && item.size !== undefined ? formatBytes(item.size) : '-'}
        </div>
      );
    },
  },
];
