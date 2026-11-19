import { contents, createDataRoom, createFolder, createTestApp, pdf, uploadFile } from './app';

describe('contents of a data room level', () => {
  it('at the root: the data room, no folder, an empty breadcrumb, and root folders and files sorted by name', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner, 'Series A');
    const legal = await createFolder(owner, room.id, 'Legal');
    await createFolder(owner, room.id, 'Finance');
    await createFolder(owner, room.id, 'Contracts', legal.id);
    await uploadFile(owner, { dataRoomId: room.id, folderId: legal.id, name: 'nda.pdf' });
    await uploadFile(owner, { dataRoomId: room.id, name: 'teaser.pdf' }, pdf('12345'));
    await uploadFile(owner, { dataRoomId: room.id, name: 'cap table.pdf' });

    const res = await owner.get(`/api/data-rooms/${room.id}/contents`).expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.dataRoom).toEqual({ id: room.id, name: 'Series A' });
    expect(data.folder).toBeNull();
    expect(data.breadcrumb).toEqual([]);
    expect(data.folders.map((f: { name: string }) => f.name)).toEqual(['Finance', 'Legal']);
    expect(data.folders[1]).toEqual(
      expect.objectContaining({ id: legal.id, parentId: null, _count: { children: 1, files: 1 } }),
    );
    expect(data.files.map((f: { name: string }) => f.name)).toEqual([
      'cap table.pdf',
      'teaser.pdf',
    ]);
    expect(data.files[1]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        dataRoomId: room.id,
        folderId: null,
        fileSize: pdf('12345').length,
        mimeType: 'application/pdf',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it('in a folder: the same shape, with the folder, its breadcrumb from the top level, and its own children', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner, 'Series A');
    const legal = await createFolder(owner, room.id, 'Legal');
    const contracts = await createFolder(owner, room.id, 'Contracts', legal.id);
    const signed = await createFolder(owner, room.id, 'Signed', contracts.id);
    await createFolder(owner, room.id, 'Drafts', contracts.id);
    await uploadFile(owner, { dataRoomId: room.id, folderId: contracts.id, name: 'spa.pdf' });
    await uploadFile(owner, { dataRoomId: room.id, name: 'teaser.pdf' });

    const data = await contents(owner, room.id, contracts.id);

    expect(data.dataRoom).toEqual({ id: room.id, name: 'Series A' });
    expect(data.folder).toEqual({ id: contracts.id, name: 'Contracts', parentId: legal.id });
    expect(data.breadcrumb).toEqual([
      { id: legal.id, name: 'Legal' },
      { id: contracts.id, name: 'Contracts' },
    ]);
    expect(data.folders.map((f) => f.name)).toEqual(['Drafts', 'Signed']);
    expect(data.folders.find((f) => f.id === signed.id)?._count).toEqual({ children: 0, files: 0 });
    expect(data.files.map((f) => f.name)).toEqual(['spa.pdf']);
  });

  it('for a top-level folder: a breadcrumb of just that folder', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner);
    const legal = await createFolder(owner, room.id, 'Legal');

    const data = await contents(owner, room.id, legal.id);

    expect(data.folder).toEqual({ id: legal.id, name: 'Legal', parentId: null });
    expect(data.breadcrumb).toEqual([{ id: legal.id, name: 'Legal' }]);
  });

  it('rejects a folder of another data room', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner, 'Room one');
    const other = await createDataRoom(owner, 'Room two');
    const legal = await createFolder(owner, other.id, 'Legal');

    const res = await owner
      .get(`/api/data-rooms/${room.id}/contents`)
      .query({ folderId: legal.id })
      .expect(404);

    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Folder not found' });
  });

  it('rejects more than one folder id', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner);

    const res = await owner
      .get(`/api/data-rooms/${room.id}/contents?folderId=a&folderId=b`)
      .expect(400);

    expect(res.body.error.details).toEqual([{ field: 'folderId', message: expect.any(String) }]);
  });
});
