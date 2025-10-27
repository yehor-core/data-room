import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { DataRooms } from '../../pages/DataRooms';
import { AuthContext } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

// Mock the API
jest.mock('../../lib/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock user
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

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
      <AuthContext.Provider value={{ user: mockUser, loading: false, signOut: jest.fn() } as any}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('DataRooms Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('shows loading skeleton initially', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {})); // Never resolves
      
      renderWithProviders(<DataRooms />);
      
      // Should show skeleton loaders
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays data rooms after loading', async () => {
      const mockDataRooms = [
        {
          id: '1',
          name: 'Project Alpha',
          description: 'Test description',
          ownerId: mockUser.id,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Project Beta',
          description: null,
          ownerId: mockUser.id,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: { data: mockDataRooms } });
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
      });
    });

    it('shows empty state when no data rooms', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('No Data Rooms Yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first data room to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Optimistic Create', () => {
    it('shows data room immediately when created', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      mockedApi.post.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ 
          data: { 
            data: {
              id: 'new-1',
              name: 'New Room',
              ownerId: mockUser.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          } 
        }), 1000);
      }));
      
      renderWithProviders(<DataRooms />);
      
      // Wait for empty state
      await waitFor(() => {
        expect(screen.getByText('No Data Rooms Yet')).toBeInTheDocument();
      });
      
      // Open create dialog
      const createButton = screen.getAllByText(/New Data Room|Create Data Room/i)[0];
      fireEvent.click(createButton);
      
      // Enter name
      const input = screen.getByPlaceholderText('Data Room Name');
      fireEvent.change(input, { target: { value: 'New Room' } });
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(submitButton);
      
      // Should appear immediately (optimistic update)
      await waitFor(() => {
        expect(screen.getByText('New Room')).toBeInTheDocument();
      }, { timeout: 100 }); // Should be nearly instant
      
      // Verify API was called
      expect(mockedApi.post).toHaveBeenCalledWith('/data-rooms', { name: 'New Room' });
    });

    it('rolls back on error', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      mockedApi.post.mockRejectedValue(new Error('Server error'));
      
      // Mock window.alert
      const alertMock = jest.spyOn(window, 'alert').mockImplementation();
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('No Data Rooms Yet')).toBeInTheDocument();
      });
      
      // Create data room
      const createButton = screen.getAllByText(/New Data Room|Create Data Room/i)[0];
      fireEvent.click(createButton);
      
      const input = screen.getByPlaceholderText('Data Room Name');
      fireEvent.change(input, { target: { value: 'Failed Room' } });
      
      const submitButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(submitButton);
      
      // Wait for error
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalled();
      });
      
      // Should roll back - not show the room
      expect(screen.queryByText('Failed Room')).not.toBeInTheDocument();
      
      alertMock.mockRestore();
    });
  });

  describe('Optimistic Delete', () => {
    it('removes data room immediately when deleted', async () => {
      const mockDataRooms = [
        {
          id: '1',
          name: 'Room to Delete',
          ownerId: mockUser.id,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: { data: mockDataRooms } });
      mockedApi.delete.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ data: { success: true } }), 1000);
      }));
      
      // Mock window.confirm
      const confirmMock = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('Room to Delete')).toBeInTheDocument();
      });
      
      // Click delete
      const deleteButton = screen.getByRole('button', { name: '' }); // Trash icon button
      fireEvent.click(deleteButton);
      
      // Should disappear immediately (optimistic update)
      await waitFor(() => {
        expect(screen.queryByText('Room to Delete')).not.toBeInTheDocument();
      }, { timeout: 100 });
      
      confirmMock.mockRestore();
    });
  });

  describe('Prefetching', () => {
    it('prefetches data on hover', async () => {
      const mockDataRooms = [
        {
          id: '1',
          name: 'Hoverable Room',
          ownerId: mockUser.id,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: { data: mockDataRooms } });
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('Hoverable Room')).toBeInTheDocument();
      });
      
      // Clear previous calls
      mockedApi.get.mockClear();
      
      // Hover over card
      const card = screen.getByText('Hoverable Room').closest('.hover\\:shadow-lg');
      if (card) {
        fireEvent.mouseEnter(card);
      }
      
      // Should trigger prefetch calls
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('Data Rooms');
      });
    });

    it('buttons have accessible names', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /new data room/i });
        expect(createButton).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error for 409 conflict', async () => {
      mockedApi.get.mockResolvedValue({ data: { data: [] } });
      mockedApi.post.mockRejectedValue({
        response: {
          status: 409,
          data: { error: 'A data room with this name already exists' }
        }
      });
      
      const alertMock = jest.spyOn(window, 'alert').mockImplementation();
      
      renderWithProviders(<DataRooms />);
      
      await waitFor(() => {
        expect(screen.getByText('No Data Rooms Yet')).toBeInTheDocument();
      });
      
      // Try to create
      const createButton = screen.getAllByText(/New Data Room|Create Data Room/i)[0];
      fireEvent.click(createButton);
      
      const input = screen.getByPlaceholderText('Data Room Name');
      fireEvent.change(input, { target: { value: 'Duplicate' } });
      
      const submitButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          expect.stringContaining('already exists')
        );
      });
      
      alertMock.mockRestore();
    });
  });
});

