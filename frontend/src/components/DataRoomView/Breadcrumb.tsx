import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { BreadcrumbItem } from '@/types';
import { levelPath } from '@/lib/paths';

interface BreadcrumbProps {
  dataRoomId: string;
  dataRoomName: string;
  /** Top-level Folder first, the current Folder last; empty at the root. */
  trail: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ dataRoomId, dataRoomName, trail }) => {
  const crumbs = [
    { id: null, name: dataRoomName },
    ...trail.map((crumb) => ({ id: crumb.id as string | null, name: crumb.name })),
  ];
  return (
    <nav aria-label="Breadcrumb" className="mt-2 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li key={crumb.id ?? 'root'} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-4 w-4" aria-hidden />}
              {isCurrent ? (
                <span aria-current="page" className="text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <Link to={levelPath(dataRoomId, crumb.id)} className="hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
