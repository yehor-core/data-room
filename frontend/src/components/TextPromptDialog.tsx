import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface TextPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  /** Receives the trimmed, non-empty value. The dialog closes right after. */
  onSubmit: (value: string) => void;
}

/** A dialog with one text field: create a Folder, rename an Item, create a data room. */
export const TextPromptDialog: React.FC<TextPromptDialogProps> = ({
  open,
  onOpenChange,
  ...props
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      {/* Mounted only while open, so every opening starts from the initial value. */}
      {open && <PromptForm {...props} onCancel={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
);

const PromptForm: React.FC<
  Omit<TextPromptDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }
> = ({ title, description, label, submitLabel, initialValue = '', onSubmit, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    onCancel();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="text-prompt">{label}</Label>
          <Input
            id="text-prompt"
            placeholder={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
};
