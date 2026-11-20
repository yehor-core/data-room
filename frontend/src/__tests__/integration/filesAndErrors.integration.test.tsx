import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderApp, server } from '@/test/renderApp';
import { apiError, seedDataRoom, seedFile, seedFolder, signedUrl } from '@/test/fakeApi';
import { expectSingleToast, gridNames, main, tree } from '@/test/screen';
import { API_URL } from '@/test/urls';

const MB = 1024 * 1024;
/**
 * A PDF that reports `size` bytes. Its content stays tiny: the size rule is checked on the client, and pushing
 * megabytes through jsdom and MSW only makes a test slow (and flaky under load) without checking anything more.
 */
const pdf = (name: string, size: number) => {
  const file = new File(['%PDF-1.7 test'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

async function openUploadDialog() {
  const room = seedDataRoom('Deals');
  seedFile(room.id, 'Budget');
  const view = renderApp(`/data-rooms/${room.id}`);
  await screen.findByRole('main');
  await main().findByText('Budget');
  await view.user.click(main().getByRole('button', { name: 'Upload File' }));
  return view;
}

function countRequests(method: string, url: string) {
  const counter = { count: 0 };
  server.events.on('request:start', ({ request }) => {
    if (request.method === method && request.url === url) counter.count++;
  });
  return counter;
}

describe('Uploading', () => {
  it('only offers PDF files in the picker', async () => {
    await openUploadDialog();

    expect(screen.getByLabelText('PDF File')).toHaveAttribute('accept', 'application/pdf');
  });

  it('rejects a file over the limit before uploading, saying what the limit is', async () => {
    const uploads = countRequests('POST', `${API_URL}/files/upload`);
    const { user } = await openUploadDialog();

    await user.upload(screen.getByLabelText('PDF File'), pdf('huge.pdf', 4 * MB + 1));

    await expectSingleToast('File is too large. The maximum size is 4 MB.');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(uploads.count).toBe(0);
  });

  it('accepts a file of exactly the limit', async () => {
    const { user } = await openUploadDialog();

    await user.upload(screen.getByLabelText('PDF File'), pdf('limit.pdf', 4 * MB));
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(gridNames('Files')).toEqual(['Budget', 'limit']));
  });

  it('rejects a non-PDF picked with "all files" before uploading', async () => {
    const uploads = countRequests('POST', `${API_URL}/files/upload`);
    await openUploadDialog();
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(
      screen.getByLabelText('PDF File'),
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    );

    await expectSingleToast('Only PDF files are accepted.');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(uploads.count).toBe(0);
  });

  it.each([
    [
      'a 413 from the hosting platform, without an envelope',
      () => new HttpResponse('Request Entity Too Large', { status: 413 }),
      'File is too large. The maximum size is 4 MB.',
    ],
    [
      'a file the server finds is not a PDF',
      () => apiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PDF files are accepted'),
      'Only PDF files are accepted.',
    ],
    [
      'a name already used in the Folder',
      () => apiError(409, 'CONFLICT', 'A file with this name already exists in this location'),
      'A file with this name already exists in this location',
    ],
  ])('keeps the dialog open and says why once for %s', async (_, respond, message) => {
    server.use(http.post(`${API_URL}/files/upload`, respond));
    const { user } = await openUploadDialog();

    await user.upload(screen.getByLabelText('PDF File'), pdf('deck.pdf', 2000));
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await expectSingleToast(message);
    expect(screen.getByRole('dialog', { name: 'Upload PDF File' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(gridNames('Files')).toEqual(['Budget']);
  });
});

describe('Opening a File', () => {
  function fakeTab() {
    const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
    const open = jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    return { tab, open };
  }

  async function setUp() {
    const room = seedDataRoom('Deals');
    const file = seedFile(room.id, 'Budget');
    seedFolder(room.id, 'Contracts');
    const view = renderApp(`/data-rooms/${room.id}`);
    await screen.findByRole('main');
    await main().findByText('Budget');
    return { ...view, file };
  }

  it.each([
    ['its card', () => main().getByRole('button', { name: /^Budget/ })],
    ['the folder tree', () => tree().getByRole('button', { name: 'Budget' })],
  ])('opens it in a new tab through a signed link from %s', async (_, target) => {
    const { tab, open } = fakeTab();
    const { user, file } = await setUp();

    await user.click(target());

    await waitFor(() => expect(tab.location.href).toBe(signedUrl(file.id)));
    expect(tab.opener).toBeNull();
    open.mockRestore();
  });

  it('opens it from the Item menu', async () => {
    const { tab, open } = fakeTab();
    const { user, file } = await setUp();

    await user.click(main().getByRole('button', { name: 'Actions for Budget' }));
    await user.click(await screen.findByRole('menuitem', { name: 'View' }));

    await waitFor(() => expect(tab.location.href).toBe(signedUrl(file.id)));
    open.mockRestore();
  });

  it('opens the signed link itself when the browser blocks the blank tab', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    const { user, file } = await setUp();

    await user.click(main().getByRole('button', { name: /^Budget/ }));

    // What is observable here: a new tab at the signed link, with no way back to this page.
    await waitFor(() =>
      expect(open).toHaveBeenLastCalledWith(
        signedUrl(file.id),
        '_blank',
        expect.stringContaining('noopener'),
      ),
    );
    open.mockRestore();
  });

  it('closes the new tab and says why when the link cannot be had', async () => {
    const { tab, open } = fakeTab();
    server.use(
      http.get(`${API_URL}/files/:id/view`, () => apiError(404, 'NOT_FOUND', 'File not found')),
    );
    const { user } = await setUp();

    await user.click(main().getByRole('button', { name: /^Budget/ }));

    await expectSingleToast('The item could not be found. It may have been deleted.');
    expect(tab.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('Error messages', () => {
  it.each([
    [
      'NOT_FOUND',
      () => apiError(404, 'NOT_FOUND', 'Folder not found'),
      'The item could not be found. It may have been deleted.',
    ],
    [
      'VALIDATION_FAILED',
      () => apiError(400, 'VALIDATION_FAILED', 'Name must be between 1 and 100 characters'),
      'Name must be between 1 and 100 characters',
    ],
    [
      'UNAUTHENTICATED',
      () => apiError(401, 'UNAUTHENTICATED', 'Invalid or expired token'),
      'Your session has expired. Please sign in again.',
    ],
    [
      'rate limiting (plain text 429)',
      () =>
        new HttpResponse('Too many requests from this IP, please try again later.', {
          status: 429,
        }),
      'Too many requests. Please wait a few minutes and try again.',
    ],
    [
      'INTERNAL',
      () => apiError(500, 'INTERNAL', 'Internal server error'),
      'Something went wrong on our end. Please try again in a few moments.',
    ],
    [
      'a network failure',
      () => HttpResponse.error(),
      'Unable to connect. Please check your internet connection and try again.',
    ],
  ])('says what went wrong for %s, exactly once', async (_, respond, message) => {
    const room = seedDataRoom('Deals');
    seedFolder(room.id, 'Contracts');
    server.use(http.patch(`${API_URL}/folders/:id/rename`, respond));
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await screen.findByRole('main');
    await main().findByText('Contracts');

    await user.click(main().getByRole('button', { name: 'Actions for Contracts' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New Name'));
    await user.type(screen.getByLabelText('New Name'), 'Agreements');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await expectSingleToast(message);
    await waitFor(() => expect(gridNames('Folders')).toEqual(['Contracts']));
  });
});
