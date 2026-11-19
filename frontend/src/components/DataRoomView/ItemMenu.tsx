import React, { useState } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Button } from '@/components/ui/Button';
import { useDataRoomActions } from '@/components/DataRoomActions';
import type { Item } from '@/data/items';
import { cn } from '@/lib/utils';

/**
 * State for one Item's menu. Spread `onContextMenu` on the element that should open the menu on right-click
 * (a card, a table row, a tree row) and `menuProps` on the ItemMenu inside it.
 */
export function useItemMenu(item: Item) {
  const [open, setOpen] = useState(false);
  return {
    menuProps: { item, open, onOpenChange: setOpen },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!item.pending) setOpen(true);
    },
  };
}

interface ItemMenuProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

/** The one menu of an Item: view (Files), rename, delete. Opened by its button or by right-click. */
export const ItemMenu: React.FC<ItemMenuProps> = ({ item, open, onOpenChange, className }) => {
  const actions = useDataRoomActions();
  return (
    // Not modal: a modal menu would leave the page inert under the dialog its items open.
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn('h-8 w-8 p-0', className)}
          disabled={item.pending}
          aria-label={`Actions for ${item.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item.type === 'file' && (
          <DropdownMenuItem onSelect={() => actions.openItem(item)}>
            <Eye className="mr-2 h-4 w-4" />
            <span>View</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => actions.renameItem(item)}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.deleteItem(item)} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
