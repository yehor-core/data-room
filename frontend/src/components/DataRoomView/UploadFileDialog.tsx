import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { toast } from '@/lib/toast';
import { ACCEPTED_FILE_TYPES, validateUpload } from '@/data/uploads';

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves to true when the upload succeeded; the dialog then closes. */
  onUpload: (upload: { file: File; name: string }) => Promise<boolean>;
}

export const UploadFileDialog: React.FC<UploadFileDialogProps> = ({
  open,
  onOpenChange,
  onUpload,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      {open && <UploadForm onUpload={onUpload} onClose={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
);

const UploadForm: React.FC<{
  onUpload: UploadFileDialogProps['onUpload'];
  onClose: () => void;
}> = ({ onUpload, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const problem = validateUpload(selected);
    if (problem) {
      toast.error(problem);
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
    setName(selected.name.replace(/\.pdf$/i, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setIsUploading(true);
    const uploaded = await onUpload({ file, name: name.trim() });
    setIsUploading(false);
    if (uploaded) onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Upload PDF File</DialogTitle>
        <DialogDescription>Select a PDF file to upload</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">PDF File</Label>
          <Input
            id="file-upload"
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file-name">File Name</Label>
          <Input
            id="file-name"
            placeholder="File Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isUploading || !file || !name.trim()}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </form>
    </>
  );
};
