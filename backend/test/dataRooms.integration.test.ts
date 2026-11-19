import { createDataRoom, createFolder, createTestApp, pdf, uploadFile } from './app';

describe('data rooms', () => {
  it('are listed for their owner only, newest first, with folder and file counts', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    const first = await createDataRoom(owner, 'First deal');
    const second = await createDataRoom(owner, 'Second deal');
    await createFolder(owner, second.id, 'Legal');
    await uploadFile(owner, { dataRoomId: second.id, name: 'nda.pdf' });
    await createDataRoom(newUser(), 'Somebody else');

    const res = await owner.get('/api/data-rooms').expect(200);

    expect(res.body).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: second.id,
          name: 'Second deal',
          _count: { folders: 1, files: 1 },
        }),
        expect.objectContaining({
          id: first.id,
          name: 'First deal',
          _count: { folders: 0, files: 0 },
        }),
      ],
    });
  });

  it('are created with a trimmed name', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();

    const res = await owner.post('/api/data-rooms').send({ name: '  Series A  ' }).expect(201);

    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: expect.any(String),
        name: 'Series A',
        _count: { folders: 0, files: 0 },
      }),
    });
  });

  it('reject a name the owner already uses', async () => {
    const { newUser } = createTestApp();
    const owner = newUser();
    await createDataRoom(owner, 'Series A');

    const res = await owner.post('/api/data-rooms').send({ name: 'Series A' }).expect(409);

    expect(res.body).toEqual({
      success: false,
      error: { code: 'CONFLICT', message: 'A data room with this name already exists' },
    });
  });

  it('may share a name with another owner’s data room', async () => {
    const { newUser } = createTestApp();
    await createDataRoom(newUser(), 'Series A');

    await newUser().post('/api/data-rooms').send({ name: 'Series A' }).expect(201);
  });

  it.each([
    [{}, 'name'],
    [{ name: '   ' }, 'name'],
    [{ name: 'ab' }, 'name'],
    [{ name: 'x'.repeat(101) }, 'name'],
    [{ name: 42 }, 'name'],
  ])('reject invalid input %j', async (body, field) => {
    const { newUser } = createTestApp();

    const res = await newUser().post('/api/data-rooms').send(body).expect(400);

    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: expect.any(String),
        details: [{ field, message: expect.any(String) }],
      },
    });
  });

  it('reject a body that is not JSON', async () => {
    const { newUser } = createTestApp();

    const res = await newUser()
      .post('/api/data-rooms')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  describe('delete', () => {
    it('removes the data room, its folders and files, and their stored content', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const keep = await createDataRoom(owner, 'Keep');
      const legal = await createFolder(owner, room.id, 'Legal');
      const contracts = await createFolder(owner, room.id, 'Contracts', legal.id);
      await uploadFile(owner, { dataRoomId: room.id, name: 'root.pdf' });
      await uploadFile(owner, { dataRoomId: room.id, folderId: contracts.id, name: 'deep.pdf' });
      const kept = await uploadFile(owner, { dataRoomId: keep.id, name: 'kept.pdf' }, pdf('kept'));

      const res = await owner.delete(`/api/data-rooms/${room.id}`).expect(204);

      expect(res.text).toBe('');
      await owner.get(`/api/data-rooms/${room.id}/contents`).expect(404);
      await owner
        .get(`/api/data-rooms/${room.id}/contents`)
        .query({ folderId: contracts.id })
        .expect(404);
      const list = await owner.get('/api/data-rooms').expect(200);
      expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([keep.id]);
      expect([...storage.objects.values()].map((o) => o.content)).toEqual([pdf('kept')]);
      await owner.get(`/api/files/${kept.id}/view`).expect(200);
    });

    it('still removes the records when storage fails, and logs the failure', async () => {
      const { newUser, storage, logs } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      storage.failRemove = true;

      await owner.delete(`/api/data-rooms/${room.id}`).expect(204);

      await owner.get(`/api/data-rooms/${room.id}/contents`).expect(404);
      expect(logs.join('\n')).toContain('Storage is unavailable');
    });
  });

  describe('of another user', () => {
    it('look exactly like data rooms that do not exist', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const stranger = newUser();
      const room = await createDataRoom(owner);
      await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      const missing = '00000000-0000-4000-8000-000000000000';

      for (const id of [room.id, missing]) {
        const contents = await stranger.get(`/api/data-rooms/${id}/contents`).expect(404);
        const deleted = await stranger.delete(`/api/data-rooms/${id}`).expect(404);
        expect(contents.body).toEqual({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Data room not found' },
        });
        expect(deleted.body).toEqual(contents.body);
      }

      const stillThere = await owner.get(`/api/data-rooms/${room.id}/contents`).expect(200);
      expect(stillThere.body.data.files).toHaveLength(1);
    });
  });
});
