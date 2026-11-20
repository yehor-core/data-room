import { filterItems, toItems } from '@/data/items';
import type { File, Folder } from '@/types';

const folder = (name: string, extra: Partial<Folder> & { pending?: boolean } = {}) => ({
  id: `folder-${name}`,
  name,
  dataRoomId: 'room-1',
  parentId: 'parent-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  _count: { children: 2, files: 3 },
  ...extra,
});

const file = (name: string, extra: Partial<File> = {}): File => ({
  id: `file-${name}`,
  name,
  dataRoomId: 'room-1',
  folderId: null,
  fileSize: 1024,
  mimeType: 'application/pdf',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...extra,
});

describe('toItems', () => {
  it('puts Folders first, then Files, each sorted by name regardless of case', () => {
    const items = toItems(
      [folder('beta'), folder('Alpha')],
      [file('zeta'), file('Delta'), file('alpha')],
    );

    expect(items.map((item) => `${item.type}:${item.name}`)).toEqual([
      'folder:Alpha',
      'folder:beta',
      'file:alpha',
      'file:Delta',
      'file:zeta',
    ]);
  });

  it('gives Folders their level, counts and pending flag', () => {
    const [item] = toItems([folder('Contracts', { pending: true })], []);

    expect(item).toEqual({
      type: 'folder',
      id: 'folder-Contracts',
      name: 'Contracts',
      parentId: 'parent-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      pending: true,
      childCount: 2,
      fileCount: 3,
    });
  });

  it('gives Files their level and size, leaving an unknown size undefined', () => {
    const [sized, unsized] = toItems(
      [],
      [file('a', { folderId: 'folder-1' }), file('b', { fileSize: null })],
    );

    expect(sized).toMatchObject({ type: 'file', parentId: 'folder-1', size: 1024, pending: false });
    expect(unsized).toMatchObject({ type: 'file', parentId: null, size: undefined });
  });
});

describe('filterItems', () => {
  const items = toItems([folder('Board minutes')], [file('Budget 2026'), file('Cap table')]);

  it('keeps the Items whose name contains the query, ignoring case and surrounding spaces', () => {
    expect(filterItems(items, '  bu ').map((item) => item.name)).toEqual(['Budget 2026']);
    expect(filterItems(items, 'B').map((item) => item.name)).toEqual([
      'Board minutes',
      'Budget 2026',
      'Cap table',
    ]);
  });

  it('keeps everything for an empty query', () => {
    expect(filterItems(items, '   ')).toBe(items);
  });

  it('keeps nothing when nothing matches', () => {
    expect(filterItems(items, 'xyz')).toEqual([]);
  });
});
