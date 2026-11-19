import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessages';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
  /** A single line, for a folder tree node. */
  compact?: boolean;
}

/** Shown instead of content when loading it failed, so a failure never looks like an empty Folder. */
export const LoadError: React.FC<LoadErrorProps> = ({ error, onRetry, compact = false }) => {
  const message = getErrorMessage(error);

  if (compact) {
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
        <span className="truncate">{message}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent role="alert" className="p-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Couldn't load this page</h3>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Button variant="outline" onClick={onRetry}>
          <RotateCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
};
