import React from 'react';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../../components/ui/Skeleton';

describe('Skeleton', () => {
  it('merges a custom className with its own classes', () => {
    render(<Skeleton data-testid="skeleton" className="custom-class" />);
    const skeleton = screen.getByTestId('skeleton');

    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('custom-class');
  });
});
