import React, { useId } from 'react';
import { Folder, Search, Plus, Upload } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  searchQuery: string;
  onCreateFolder: () => void;
  onUploadFile: () => void;
  onClearSearch: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchQuery,
  onCreateFolder,
  onUploadFile,
  onClearSearch,
}) => {
  const query = searchQuery.trim();
  const headingId = useId();
  return (
    <Card role="region" aria-labelledby={headingId}>
      <CardContent className="p-12 text-center">
        {query ? (
          <>
            <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 id={headingId} className="text-xl font-semibold mb-2">
              No results found
            </h3>
            <p className="text-muted-foreground mb-6">No files or folders match "{query}"</p>
            <Button variant="outline" onClick={onClearSearch}>
              Clear Search
            </Button>
          </>
        ) : (
          <>
            <Folder className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 id={headingId} className="text-xl font-semibold mb-2">
              No files or folders yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Upload files or create folders to get started
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={onCreateFolder}>
                <Plus className="mr-2 h-4 w-4" />
                Create Folder
              </Button>
              <Button variant="outline" onClick={onUploadFile}>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
