import React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../../components/ui/Skeleton';

describe('Skeleton Component', () => {
  describe('Basic Skeleton', () => {
    it('renders with default props', () => {
      render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');

      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted');
    });

    it('applies custom className', () => {
      render(<Skeleton data-testid="skeleton" className="h-10 w-full" />);
      const skeleton = screen.getByTestId('skeleton');

      expect(skeleton).toHaveClass('h-10', 'w-full');
    });

    it('merges className properly', () => {
      render(<Skeleton data-testid="skeleton" className="custom-class" />);
      const skeleton = screen.getByTestId('skeleton');

      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('custom-class');
    });
  });
});
