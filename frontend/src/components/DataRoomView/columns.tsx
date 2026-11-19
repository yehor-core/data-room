import { ColumnDef, CellContext, HeaderContext } from "@tanstack/react-table"
import { ArrowUpDown, Folder, File as FileIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { File, Folder as IFolder } from "@/types"
import { formatBytes, formatDate } from "@/lib/utils"
import { ItemActions } from './ItemActions';

// Merged type for table and grid views
export type DataRoomItem = (IFolder & { type: 'folder', size: null }) | (File & { type: 'file', size: number });

const sortableHeader =
  (label: string) =>
  ({ column }: HeaderContext<DataRoomItem, unknown>) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )

const columns: ColumnDef<DataRoomItem>[] = [
  {
    accessorKey: "name",
    header: sortableHeader("Name"),
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original;
      const isFolder = item.type === 'folder';
      const Icon = isFolder ? Folder : FileIcon;
      
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{item.name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: sortableHeader("Date Modified"),
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      return <div>{formatDate(row.original.updatedAt)}</div>;
    },
  },
  {
    accessorKey: "size",
    header: sortableHeader("File Size"),
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original;
      if (item.type === 'folder') {
        return <div className="text-right">-</div>;
      }
      return <div className="text-right">{formatBytes(item.size)}</div>;
    },
  },
]

export const getColumns = (
  onView: (item: DataRoomItem) => void,
  onRename: (item: DataRoomItem) => void,
  onDelete: (item: DataRoomItem) => void
): ColumnDef<DataRoomItem>[] => {
  const actionsColumn: ColumnDef<DataRoomItem> = {
    id: "actions",
    cell: ({ row }: CellContext<DataRoomItem, unknown>) => {
      const item = row.original;
      return (
        <div className="text-right">
          <ItemActions
            onView={item.type === 'file' ? () => onView(item) : undefined}
            onRename={() => onRename(item)}
            onDelete={() => onDelete(item)}
          />
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
  };
  
  return [...columns, actionsColumn];
}
