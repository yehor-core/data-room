import { buildBreadcrumb, subtreeIds } from '../folderTree';

const folder = (id: string, parentId: string | null) => ({ id, name: id.toUpperCase(), parentId });

describe('buildBreadcrumb', () => {
  it('lists the folders from the top level down to the given folder', () => {
    const folders = [folder('c', 'b'), folder('x', null), folder('a', null), folder('b', 'a')];

    expect(buildBreadcrumb(folders, 'c')).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
  });

  it('is just the folder for a top-level folder', () => {
    expect(buildBreadcrumb([folder('a', null)], 'a')).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('is empty for an unknown folder', () => {
    expect(buildBreadcrumb([folder('a', null)], 'zzz')).toEqual([]);
  });

  it('stops at a repeated folder instead of looping on a cycle', () => {
    const folders = [folder('a', 'c'), folder('b', 'a'), folder('c', 'b')];

    expect(buildBreadcrumb(folders, 'c')).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
  });

  it('stops where a parent is missing', () => {
    expect(buildBreadcrumb([folder('b', 'gone')], 'b')).toEqual([{ id: 'b', name: 'B' }]);
  });
});

describe('subtreeIds', () => {
  it('is the folder and every folder nested under it', () => {
    const folders = [
      folder('a', null),
      folder('b', 'a'),
      folder('c', 'b'),
      folder('d', 'a'),
      folder('x', null),
      folder('y', 'x'),
    ];

    expect(subtreeIds(folders, 'a').sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('terminates on a cycle', () => {
    const folders = [folder('a', 'b'), folder('b', 'a')];

    expect(subtreeIds(folders, 'a').sort()).toEqual(['a', 'b']);
  });
});
