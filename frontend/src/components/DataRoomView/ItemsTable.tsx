import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { Item } from '@/data/items';
import { columns } from './columns';
import { ItemMenu, useItemMenu } from './ItemMenu';

const ItemRow: React.FC<{ row: Row<Item> }> = ({ row }) => {
  const { menuProps, onContextMenu } = useItemMenu(row.original);
  return (
    <TableRow
      onContextMenu={onContextMenu}
      aria-busy={row.original.pending || undefined}
      className={row.original.pending ? 'opacity-60' : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
      <TableCell className="text-right">
        <ItemMenu {...menuProps} />
      </TableCell>
    </TableRow>
  );
};

export const ItemsTable: React.FC<{ items: Item[] }> = ({ items }) => {
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (item) => item.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <ItemRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
