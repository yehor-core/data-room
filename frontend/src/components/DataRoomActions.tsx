import React, { createContext, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/AlertDialog';
import { TextPromptDialog } from './TextPromptDialog';
import { UploadFileDialog } from './DataRoomView/UploadFileDialog';
import { openFile, useDataRoomContents, useDataRoomMutations } from '@/data/dataRoom';
import type { Item } from '@/data/items';
import { levelPath } from '@/lib/paths';

interface DataRoomActions {
  /** Opens a Folder on the data room screen, or a File in a new tab. */
  openItem: (item: Item) => void;
  startCreateFolder: () => void;
  startUpload: () => void;
  renameItem: (item: Item) => void;
  deleteItem: (item: Item) => void;
}

const DataRoomActionsContext = createContext<DataRoomActions | undefined>(undefined);

export const useDataRoomActions = () => {
  const context = useContext(DataRoomActionsContext);
  if (!context) {
    throw new Error('useDataRoomActions must be used within a DataRoomActionsProvider');
  }
  return context;
};

type OpenDialog =
  | { kind: 'createFolder' }
  | { kind: 'upload' }
  | { kind: 'rename'; item: Item }
  | { kind: 'delete'; item: Item }
  | null;

interface DataRoomActionsProviderProps {
  dataRoomId: string;
  /** The level the screen shows: new Folders and uploads go there. */
  folderId: string | null;
  children: React.ReactNode;
}

/** Owns the data room dialogs, so the screen, grids, table and tree can trigger actions directly. */
export const DataRoomActionsProvider: React.FC<DataRoomActionsProviderProps> = ({
  dataRoomId,
  folderId,
  children,
}) => {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const navigate = useNavigate();
  const mutations = useDataRoomMutations(dataRoomId);
  const { breadcrumb } = useDataRoomContents(dataRoomId, folderId);
  const close = () => setDialog(null);

  const confirmDelete = (item: Item) => {
    // Deleting the Folder on screen (or one above it) leaves nothing to show: go to where the Folder was.
    if (item.type === 'folder' && breadcrumb.some((crumb) => crumb.id === item.id)) {
      navigate(levelPath(dataRoomId, item.parentId));
    }
    void mutations.deleteItem(item);
  };

  const actions = useMemo<DataRoomActions>(
    () => ({
      openItem: (item) =>
        item.type === 'folder' ? navigate(levelPath(dataRoomId, item.id)) : void openFile(item.id),
      startCreateFolder: () => setDialog({ kind: 'createFolder' }),
      startUpload: () => setDialog({ kind: 'upload' }),
      renameItem: (item) => setDialog({ kind: 'rename', item }),
      deleteItem: (item) => setDialog({ kind: 'delete', item }),
    }),
    [navigate, dataRoomId],
  );

  const renaming = dialog?.kind === 'rename' ? dialog.item : null;
  const deleting = dialog?.kind === 'delete' ? dialog.item : null;

  return (
    <DataRoomActionsContext.Provider value={actions}>
      {children}

      <TextPromptDialog
        open={dialog?.kind === 'createFolder'}
        onOpenChange={close}
        title="Create New Folder"
        description="Enter a name for the new folder"
        label="Folder Name"
        submitLabel="Create"
        onSubmit={(name) => void mutations.createFolder({ name, parentId: folderId })}
      />
      <TextPromptDialog
        open={!!renaming}
        onOpenChange={close}
        title={`Rename ${renaming?.type === 'folder' ? 'Folder' : 'File'}`}
        description="Enter a new name"
        label="New Name"
        submitLabel="Rename"
        initialValue={renaming?.name}
        onSubmit={(name) => renaming && void mutations.renameItem({ item: renaming, name })}
      />
      <UploadFileDialog
        open={dialog?.kind === 'upload'}
        onOpenChange={close}
        onUpload={({ file, name }) => mutations.uploadFile({ file, name, folderId })}
      />
      <AlertDialog open={!!deleting} onOpenChange={close}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item "{deleting?.name}
              ".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && confirmDelete(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DataRoomActionsContext.Provider>
  );
};
