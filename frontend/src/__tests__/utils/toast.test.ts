import { screen } from '@testing-library/react';
import { toast } from '../../lib/toast';

describe('toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it.each([
    ['success', '✓'],
    ['error', '✕'],
  ] as const)('shows a %s message with its icon and hides it after 3 seconds', (type, icon) => {
    toast[type]('Saved');

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText(icon)).toBeInTheDocument();

    jest.advanceTimersByTime(3300);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('keeps a loading message until it is dismissed', () => {
    const id = toast.loading('Uploading file...');
    expect(screen.getByText('Uploading file...')).toBeInTheDocument();
    expect(screen.getByText('⟳')).toBeInTheDocument();

    jest.advanceTimersByTime(10000);
    expect(screen.getByText('Uploading file...')).toBeInTheDocument();

    toast.dismiss(id);
    jest.advanceTimersByTime(300);
    expect(screen.queryByText('Uploading file...')).not.toBeInTheDocument();
  });
});
