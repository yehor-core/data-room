import { contents, createDataRoom, createFolder, createTestApp, pdf, uploadFile } from './app';

const missing = '00000000-0000-4000-8000-000000000000';

describe('folders', () => {
  describe('create', () => {
    it('adds a folder at the root of a data room', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await owner
        .post('/api/folders')
        .send({ name: ' Legal ', dataRoomId: room.id })
        .expect(201);

      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name: 'Legal',
          parentId: null,
          dataRoomId: room.id,
          _count: { children: 0, files: 0 },
        }),
      });
      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual(['Legal']);
    });

    it.each([null, ''])('adds a folder at the root when parentId is %p', async (parentId) => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await owner
        .post('/api/folders')
        .send({ name: 'Legal', dataRoomId: room.id, parentId })
        .expect(201);

      expect(res.body.data.parentId).toBeNull();
      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual(['Legal']);
    });

    it('adds a folder inside another folder', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      const contracts = await createFolder(owner, room.id, 'Contracts', legal.id);

      expect(contracts.parentId).toBe(legal.id);
      expect((await contents(owner, room.id, legal.id)).folders.map((f) => f.name)).toEqual([
        'Contracts',
      ]);
    });

    it('rejects a name a sibling folder already has, at the root and inside a folder', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      await createFolder(owner, room.id, 'Contracts', legal.id);

      const atRoot = await owner
        .post('/api/folders')
        .send({ name: 'Legal', dataRoomId: room.id })
        .expect(409);
      const nested = await owner
        .post('/api/folders')
        .send({ name: 'Contracts', dataRoomId: room.id, parentId: legal.id })
        .expect(409);

      for (const res of [atRoot, nested]) {
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A folder with this name already exists in this location',
          },
        });
      }
    });

    it('allows the same name under a different parent', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      await owner
        .post('/api/folders')
        .send({ name: 'Legal', dataRoomId: room.id, parentId: legal.id })
        .expect(201);
    });

    it('rejects a parent folder from another data room', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner, 'Room one');
      const other = await createDataRoom(owner, 'Room two');
      const otherFolder = await createFolder(owner, other.id, 'Legal');

      const res = await owner
        .post('/api/folders')
        .send({ name: 'Contracts', dataRoomId: room.id, parentId: otherFolder.id })
        .expect(404);

      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Folder not found' });
    });

    it.each([
      [{ dataRoomId: missing }, 'name'],
      [{ name: '', dataRoomId: missing }, 'name'],
      [{ name: 'x'.repeat(101), dataRoomId: missing }, 'name'],
      [{ name: 'Legal' }, 'dataRoomId'],
      [{ name: 'Legal', dataRoomId: missing, parentId: 7 }, 'parentId'],
    ])('rejects invalid input %j', async (body, field) => {
      const { newUser } = createTestApp();

      const res = await newUser().post('/api/folders').send(body).expect(400);

      expect(res.body.error).toEqual({
        code: 'VALIDATION_FAILED',
        message: expect.any(String),
        details: [{ field, message: expect.any(String) }],
      });
    });
  });

  describe('rename', () => {
    it('changes the name', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      const res = await owner
        .patch(`/api/folders/${legal.id}/rename`)
        .send({ name: 'Legal & Tax' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: legal.id,
          name: 'Legal & Tax',
          _count: { children: 0, files: 0 },
        }),
      });
      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual(['Legal & Tax']);
    });

    it('keeps the name when it is unchanged', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      await owner.patch(`/api/folders/${legal.id}/rename`).send({ name: 'Legal' }).expect(200);
    });

    it('rejects a name a sibling folder already has', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      await createFolder(owner, room.id, 'Finance');
      const inner = await createFolder(owner, room.id, 'A', legal.id);
      await createFolder(owner, room.id, 'B', legal.id);

      const root = await owner
        .patch(`/api/folders/${legal.id}/rename`)
        .send({ name: 'Finance' })
        .expect(409);
      const nested = await owner
        .patch(`/api/folders/${inner.id}/rename`)
        .send({ name: 'B' })
        .expect(409);

      expect(root.body.error.code).toBe('CONFLICT');
      expect(nested.body.error.code).toBe('CONFLICT');
      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual([
        'Finance',
        'Legal',
      ]);
    });

    it('rejects a blank name', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      const res = await owner
        .patch(`/api/folders/${legal.id}/rename`)
        .send({ name: '  ' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('delete', () => {
    it('removes the folder with every nested folder and file and their stored content', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const contracts = await createFolder(owner, room.id, 'Contracts', legal.id);
      const signed = await createFolder(owner, room.id, 'Signed', contracts.id);
      await uploadFile(owner, { dataRoomId: room.id, folderId: legal.id, name: 'a.pdf' });
      await uploadFile(owner, { dataRoomId: room.id, folderId: signed.id, name: 'b.pdf' });
      const finance = await createFolder(owner, room.id, 'Finance');
      await uploadFile(
        owner,
        { dataRoomId: room.id, folderId: finance.id, name: 'c.pdf' },
        pdf('kept'),
      );
      await uploadFile(owner, { dataRoomId: room.id, name: 'root.pdf' }, pdf('kept'));

      const res = await owner.delete(`/api/folders/${legal.id}`).expect(204);

      expect(res.text).toBe('');
      const root = await contents(owner, room.id);
      expect(root.folders.map((f) => f.name)).toEqual(['Finance']);
      expect(root.files.map((f) => f.name)).toEqual(['root.pdf']);
      for (const gone of [legal, contracts, signed]) {
        await owner
          .get(`/api/data-rooms/${room.id}/contents`)
          .query({ folderId: gone.id })
          .expect(404);
      }
      expect([...storage.objects.values()].map((o) => o.content)).toEqual([
        pdf('kept'),
        pdf('kept'),
      ]);
    });

    it('still removes the records when storage fails, and logs the failure', async () => {
      const { newUser, storage, logs } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      await uploadFile(owner, { dataRoomId: room.id, folderId: legal.id, name: 'a.pdf' });
      storage.failRemove = true;

      await owner.delete(`/api/folders/${legal.id}`).expect(204);

      expect((await contents(owner, room.id)).folders).toEqual([]);
      expect(logs.join('\n')).toContain('Storage is unavailable');
    });
  });

  describe('of another user', () => {
    it('can not be read, renamed or deleted, and look exactly like folders that do not exist', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const stranger = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const strangerRoom = await createDataRoom(stranger);

      for (const id of [legal.id, missing]) {
        const responses = [
          await stranger
            .get(`/api/data-rooms/${strangerRoom.id}/contents`)
            .query({ folderId: id })
            .expect(404),
          await stranger.patch(`/api/folders/${id}/rename`).send({ name: 'Mine now' }).expect(404),
          await stranger.delete(`/api/folders/${id}`).expect(404),
        ];
        for (const res of responses) {
          expect(res.body).toEqual({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Folder not found' },
          });
        }
      }

      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual(['Legal']);
    });

    it('can not receive new folders, in their data room or under their folders', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const stranger = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const strangerRoom = await createDataRoom(stranger);

      const intoRoom = await stranger
        .post('/api/folders')
        .send({ name: 'Planted', dataRoomId: room.id })
        .expect(404);
      const underFolder = await stranger
        .post('/api/folders')
        .send({ name: 'Planted', dataRoomId: strangerRoom.id, parentId: legal.id })
        .expect(404);

      expect(intoRoom.body.error).toEqual({ code: 'NOT_FOUND', message: 'Data room not found' });
      expect(underFolder.body.error).toEqual({ code: 'NOT_FOUND', message: 'Folder not found' });
      expect((await contents(owner, room.id, legal.id)).folders).toEqual([]);
      expect((await contents(owner, room.id)).folders.map((f) => f.name)).toEqual(['Legal']);
    });
  });
});
