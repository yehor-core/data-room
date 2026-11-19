import React from 'react';
import { render } from '@testing-library/react';
import { Skeleton } from '../../components/ui/Skeleton';

describe('Skeleton Component', () => {
  describe('Basic Skeleton', () => {
    it('renders with default props', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted');
    });

    it('applies custom className', () => {
      const { container } = render(<Skeleton className="h-10 w-full" />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toHaveClass('h-10', 'w-full');
    });

    it('merges className properly', () => {
      const { container } = render(<Skeleton className="custom-class" />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('custom-class');
    });
  });
});
