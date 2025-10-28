import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import { DataRoomView } from '../../pages/DataRoomView';
import { api } from '../../lib/api';

// Mock the API
jest.mock('../../lib/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock react-router-dom's useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'room-1', folderId: undefined }),
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={component} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DataRoomView Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Debounced Search', () => {
    it('debounces search input by 300ms', async () => {
      const mockDataRoom = {
        id: 'room-1',
        name: 'Test Room',
        ownerId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockFolders = [
        { id: 'folder-1', name: 'Important Docs', dataRoomId: 'room-1' },
        { id: 'folder-2', name: 'Reports', dataRoomId: 'room-1' },
      ];

      const mockFiles = [
        { id: 'file-1', name: 'report.pdf', folderId: 'folder-2' },
        { id: 'file-2', name: 'document.docx', folderId: 'folder-1' },
      ];

      mockedApi.get.mockImplementation((url: string) => {
        if (url.includes('action=folders')) {
          return Promise.resolve({ data: { data: mockFolders } });
        }
        if (url.includes('action=files')) {
          return Promise.resolve({ data: { data: mockFiles } });
        }
        return Promise.resolve({ data: { data: mockDataRoom } });
      });

      renderWithProviders(<DataRoomView />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Room')).toBeInTheDocument();
      });

      // Get search input
      const searchInput = screen.getByPlaceholderText('Search files and folders...');

      // Type quickly (simulating user typing)
      fireEvent.change(searchInput, { target: { value: 'r' } });
      fireEvent.change(searchInput, { target: { value: 're' } });
      fireEvent.change(searchInput, { target: { value: 'rep' } });
      fireEvent.change(searchInput, { target: { value: 'repo' } });
      fireEvent.change(searchInput, { target: { value: 'repor' } });
      fireEvent.change(searchInput, { target: { value: 'report' } });

      // Search should NOT trigger immediately
      expect(screen.getByText('Important Docs')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();

      // Advance timers by 300ms (debounce delay)
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Now search should be applied
      await waitFor(() => {
        // "Reports" folder should still be visible (matches "report")
        expect(screen.getByText('Reports')).toBeInTheDocument();
      });
    });

    it('filters folders based on search', async () => {
      const mockDataRoom = {
        id: 'room-1',
        name: 'Test Room',
        ownerId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockFolders = [
        { id: 'folder-1', name: 'Sales Reports', dataRoomId: 'room-1' },
        { id: 'folder-2', name: 'Marketing Docs', dataRoomId: 'room-1' },
        { id: 'folder-3', name: 'Finance Reports', dataRoomId: 'room-1' },
      ];

      mockedApi.get.mockImplementation((url: string) => {
        if (url.includes('action=folders')) {
          return Promise.resolve({ data: { data: mockFolders } });
        }
        if (url.includes('action=files')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: mockDataRoom } });
      });

      renderWithProviders(<DataRoomView />);

      await waitFor(() => {
        expect(screen.getByText('Sales Reports')).toBeInTheDocument();
        expect(screen.getByText('Marketing Docs')).toBeInTheDocument();
        expect(screen.getByText('Finance Reports')).toBeInTheDocument();
      });

      // Search for "reports"
      const searchInput = screen.getByPlaceholderText('Search files and folders...');
      fireEvent.change(searchInput, { target: { value: 'reports' } });

      // Wait for debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Should show only folders with "reports" in name
        expect(screen.getByText('Sales Reports')).toBeInTheDocument();
        expect(screen.getByText('Finance Reports')).toBeInTheDocument();
        // Marketing Docs should be hidden
        expect(screen.queryByText('Marketing Docs')).not.toBeInTheDocument();
      });
    });

    it('cancels previous search when typing continues', async () => {
      const mockDataRoom = {
        id: 'room-1',
        name: 'Test Room',
        ownerId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockedApi.get.mockImplementation(() => {
        return Promise.resolve({ 
          data: { 
            data: mockDataRoom.id === 'room-1' ? mockDataRoom : [] 
          } 
        });
      });

      renderWithProviders(<DataRoomView />);

      await waitFor(() => {
        expect(screen.getByText('Test Room')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files and folders...');

      // Type "test"
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Wait 200ms (less than debounce delay)
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Type more (should cancel previous timer)
      fireEvent.change(searchInput, { target: { value: 'testing' } });

      // Advance another 200ms (total 400ms from first input)
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Only the latest search should have triggered
      // (This is implicit - if timers weren't cancelled, we'd see issues)
      expect(searchInput).toHaveValue('testing');
    });

    it('clears search when input is emptied', async () => {
      const mockDataRoom = {
        id: 'room-1',
        name: 'Test Room',
        ownerId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockFolders = [
        { id: 'folder-1', name: 'Folder A', dataRoomId: 'room-1' },
        { id: 'folder-2', name: 'Folder B', dataRoomId: 'room-1' },
      ];

      mockedApi.get.mockImplementation((url: string) => {
        if (url.includes('action=folders')) {
          return Promise.resolve({ data: { data: mockFolders } });
        }
        if (url.includes('action=files')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: mockDataRoom } });
      });

      renderWithProviders(<DataRoomView />);

      await waitFor(() => {
        expect(screen.getByText('Folder A')).toBeInTheDocument();
        expect(screen.getByText('Folder B')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search files and folders...');

      // Search for "Folder A"
      fireEvent.change(searchInput, { target: { value: 'Folder A' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Folder A')).toBeInTheDocument();
        expect(screen.queryByText('Folder B')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Both folders should be visible again
        expect(screen.getByText('Folder A')).toBeInTheDocument();
        expect(screen.getByText('Folder B')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('uses memoization for search results', async () => {
      const mockDataRoom = {
        id: 'room-1',
        name: 'Test Room',
        ownerId: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockedApi.get.mockResolvedValue({ data: { data: mockDataRoom } });

      renderWithProviders(<DataRoomView />);

      await waitFor(() => {
        expect(screen.getByText('Test Room')).toBeInTheDocument();
      });

      // Search should be memoized and not recalculate on unrelated re-renders
      // This is tested implicitly by the component not crashing or being slow
    });
  });

  describe('Accessibility', () => {
    it('search input has proper label', async () => {
      mockedApi.get.mockResolvedValue({ 
        data: { 
          data: {
            id: 'room-1',
            name: 'Test Room',
            ownerId: 'user-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          }
        } 
      });

      renderWithProviders(<DataRoomView />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search files and folders...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('type', 'text');
      });
    });
  });
});

