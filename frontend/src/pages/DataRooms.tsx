import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/AlertDialog';
import { Skeleton } from '../components/ui/Skeleton';
import { Header } from '../components/Header';
import { LoadError } from '../components/LoadError';
import { TextPromptDialog } from '../components/TextPromptDialog';
import { formatDate } from '../lib/utils';
import { levelPath } from '../lib/paths';
import { useDataRoomListMutations, useDataRooms, usePrefetchDataRoom } from '../data/dataRooms';

export const DataRooms: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { dataRooms, isLoading, error, retry } = useDataRooms();
  const { createDataRoom, deleteDataRoom } = useDataRoomListMutations();
  const prefetchDataRoom = usePrefetchDataRoom();

  const newDataRoomButton = (label: string) => (
    <Button onClick={() => setIsCreateDialogOpen(true)}>
      <Plus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  } else if (error) {
    content = <LoadError error={error} onRetry={retry} />;
  } else if (dataRooms.length > 0) {
    content = (
      <div role="list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dataRooms.map((dataRoom) => (
          <Card
            key={dataRoom.id}
            role="listitem"
            aria-label={dataRoom.name}
            className="hover:shadow-lg transition-shadow"
            aria-busy={dataRoom.pending || undefined}
            onMouseEnter={dataRoom.pending ? undefined : () => prefetchDataRoom(dataRoom.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                {dataRoom.name}
              </CardTitle>
              <CardDescription>Created {formatDate(dataRoom.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {dataRoom._count.folders} {dataRoom._count.folders === 1 ? 'folder' : 'folders'}
                </span>
                <div className="flex gap-2">
                  {dataRoom.pending ? (
                    <Button variant="outline" size="sm" disabled>
                      Creating...
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={levelPath(dataRoom.id)}>Open</Link>
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={dataRoom.pending}
                        aria-label={`Delete ${dataRoom.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete this data room
                          and all of its contents.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDataRoom(dataRoom.id)}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  } else {
    content = (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Rooms Yet</h3>
          <p className="text-muted-foreground mb-4">Create your first data room to get started</p>
          {newDataRoomButton('Create Data Room')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Header title="Data Rooms" subtitle="Manage your secure document repositories">
          {newDataRoomButton('New Data Room')}
        </Header>
      </div>

      {content}

      <TextPromptDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title="Create New Data Room"
        description="Enter a name for your new data room"
        label="Name"
        submitLabel="Create"
        onSubmit={createDataRoom}
      />
    </div>
  );
};
