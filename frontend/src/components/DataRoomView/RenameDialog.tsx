import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'folder' | 'file' | null;
  newName: string;
  onNewNameChange: (name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  onOpenChange,
  itemType,
  newName,
  onNewNameChange,
  onSubmit,
  isPending,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {itemType === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>Enter a new name</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">New Name</Label>
            <Input
              id="new-name"
              placeholder="New Name"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

