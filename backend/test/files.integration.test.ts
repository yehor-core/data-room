import {
  contents,
  createDataRoom,
  createFolder,
  createTestApp,
  pdf,
  upload,
  uploadFile,
} from './app';

const missing = '00000000-0000-4000-8000-000000000000';
const MB = 1024 * 1024;

/** A PDF of exactly `bytes` bytes. */
const pdfOfSize = (bytes: number) =>
  Buffer.concat([pdf(), Buffer.alloc(bytes - pdf().length, 'a')]);

describe('files', () => {
  describe('upload', () => {
    it('stores a PDF at the root of a data room, keeping its real content type', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await upload(
        owner,
        { dataRoomId: room.id, name: 'Teaser.pdf' },
        { content: pdf('teaser') },
      ).expect(201);

      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          name: 'Teaser.pdf',
          dataRoomId: room.id,
          folderId: null,
          fileSize: pdf('teaser').length,
          mimeType: 'application/pdf',
        }),
      });
      const view = await owner.get(`/api/files/${res.body.data.id}/view`).expect(200);
      expect(storage.objectAt(view.body.data.url)).toEqual({
        content: pdf('teaser'),
        contentType: 'application/pdf',
      });
    });

    it('stores a PDF in a folder', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');

      const file = await uploadFile(owner, {
        dataRoomId: room.id,
        folderId: legal.id,
        name: 'nda.pdf',
      });

      expect(file.folderId).toBe(legal.id);
      expect((await contents(owner, room.id, legal.id)).files.map((f) => f.name)).toEqual([
        'nda.pdf',
      ]);
      expect((await contents(owner, room.id)).files).toEqual([]);
    });

    it('stores a PDF at the root when the folder id is empty', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await owner
        .post('/api/files/upload')
        .field('dataRoomId', room.id)
        .field('folderId', '')
        .field('name', 'nda.pdf')
        .attach('file', pdf(), { filename: 'nda.pdf', contentType: 'application/pdf' })
        .expect(201);

      expect(res.body.data.folderId).toBeNull();
      expect((await contents(owner, room.id)).files.map((f) => f.name)).toEqual(['nda.pdf']);
    });

    it('names the file after the uploaded file when no name is given', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await upload(
        owner,
        { dataRoomId: room.id },
        { filename: 'Board minutes.pdf' },
      ).expect(201);

      expect(res.body.data.name).toBe('Board minutes.pdf');
    });

    it('accepts a file of exactly the size limit', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await upload(
        owner,
        { dataRoomId: room.id, name: 'big.pdf' },
        { content: pdfOfSize(4 * MB) },
      ).expect(201);

      expect(res.body.data.fileSize).toBe(4 * MB);
    });

    it('rejects a file over the size limit with a message stating the limit, storing nothing', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await upload(
        owner,
        { dataRoomId: room.id },
        { content: pdfOfSize(4 * MB + 1) },
      ).expect(413);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'File is larger than the 4 MB limit' },
      });
      expect(storage.objects.size).toBe(0);
      expect((await contents(owner, room.id)).files).toEqual([]);
    });

    it.each([
      [
        'a non-PDF type',
        { filename: 'notes.txt', contentType: 'text/plain', content: Buffer.from('just text') },
      ],
      [
        'PDF bytes declared as another type',
        { filename: 'doc.png', contentType: 'image/png', content: pdf() },
      ],
      [
        'a PDF type without PDF content',
        {
          filename: 'fake.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('MZ\x90\x00'),
        },
      ],
    ])('rejects %s, storing nothing', async (_case, file) => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await upload(owner, { dataRoomId: room.id }, file).expect(415);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Only PDF files are accepted' },
      });
      expect(storage.objects.size).toBe(0);
    });

    it('rejects a name already used by a file in the same place, storing nothing', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      await uploadFile(owner, { dataRoomId: room.id, folderId: legal.id, name: 'nda.pdf' });

      const atRoot = await upload(owner, { dataRoomId: room.id, name: 'nda.pdf' }).expect(409);
      const inFolder = await upload(owner, {
        dataRoomId: room.id,
        folderId: legal.id,
        name: 'nda.pdf',
      }).expect(409);

      for (const res of [atRoot, inFolder]) {
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A file with this name already exists in this location',
          },
        });
      }
      expect(storage.objects.size).toBe(2);
    });

    it('removes the stored content again when the database rejects the file, as when a concurrent upload took the name', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      let releaseFirst!: () => void;
      let firstReachedStorage!: () => void;
      const reachedStorage = new Promise<void>((resolve) => (firstReachedStorage = resolve));
      storage.beforePut = () => {
        storage.beforePut = undefined;
        firstReachedStorage();
        return new Promise((resolve) => (releaseFirst = resolve));
      };

      const first = upload(
        owner,
        { dataRoomId: room.id, name: 'nda.pdf' },
        { content: pdf('first') },
      ).then((r) => r);
      await reachedStorage;
      await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' }, pdf('second'));
      releaseFirst();
      const res = await first;

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect([...storage.objects.values()].map((o) => o.content)).toEqual([pdf('second')]);
    });

    it('rejects a folder that belongs to a different data room', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner, 'Room one');
      const other = await createDataRoom(owner, 'Room two');
      const otherFolder = await createFolder(owner, other.id, 'Legal');

      const res = await upload(owner, { dataRoomId: room.id, folderId: otherFolder.id }).expect(
        404,
      );

      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Folder not found' });
      expect(storage.objects.size).toBe(0);
      expect((await contents(owner, other.id, otherFolder.id)).files).toEqual([]);
    });

    it('is refused for another user’s data room and folders', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const stranger = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const strangerRoom = await createDataRoom(stranger);

      const intoRoom = await upload(stranger, { dataRoomId: room.id }).expect(404);
      const intoFolder = await upload(stranger, { dataRoomId: room.id, folderId: legal.id }).expect(
        404,
      );
      const viaOwnRoom = await upload(stranger, {
        dataRoomId: strangerRoom.id,
        folderId: legal.id,
      }).expect(404);

      expect(intoRoom.body.error).toEqual({ code: 'NOT_FOUND', message: 'Data room not found' });
      expect(intoFolder.body.error).toEqual({ code: 'NOT_FOUND', message: 'Data room not found' });
      expect(viaOwnRoom.body.error).toEqual({ code: 'NOT_FOUND', message: 'Folder not found' });
      expect(storage.objects.size).toBe(0);
      expect((await contents(owner, room.id)).files).toEqual([]);
      expect((await contents(owner, room.id, legal.id)).files).toEqual([]);
    });

    it('rejects a request without a file', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await owner
        .post('/api/files/upload')
        .field('dataRoomId', room.id)
        .field('name', 'x.pdf')
        .expect(400);

      expect(res.body.error).toEqual({
        code: 'VALIDATION_FAILED',
        message: expect.any(String),
        details: [{ field: 'file', message: 'A file is required' }],
      });
    });

    it('rejects a request without a data room', async () => {
      const { newUser } = createTestApp();

      const res = await newUser()
        .post('/api/files/upload')
        .attach('file', pdf(), { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(400);

      expect(res.body.error.details).toEqual([
        { field: 'dataRoomId', message: 'dataRoomId is required' },
      ]);
    });

    it('rejects the file under an unexpected field name', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);

      const res = await owner
        .post('/api/files/upload')
        .field('dataRoomId', room.id)
        .attach('document', pdf(), { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('rename', () => {
    it('changes the name, at the root and in a folder', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const rootFile = await uploadFile(owner, { dataRoomId: room.id, name: 'draft.pdf' });
      const nested = await uploadFile(owner, {
        dataRoomId: room.id,
        folderId: legal.id,
        name: 'draft.pdf',
      });

      const res = await owner
        .patch(`/api/files/${rootFile.id}/rename`)
        .send({ name: ' Final.pdf ' })
        .expect(200);
      await owner.patch(`/api/files/${nested.id}/rename`).send({ name: 'Signed.pdf' }).expect(200);

      expect(res.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: rootFile.id,
          name: 'Final.pdf',
          fileSize: rootFile.fileSize,
        }),
      });
      expect((await contents(owner, room.id)).files.map((f) => f.name)).toEqual(['Final.pdf']);
      expect((await contents(owner, room.id, legal.id)).files.map((f) => f.name)).toEqual([
        'Signed.pdf',
      ]);
    });

    it('rejects a name another file in the same place already has', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      const a = await uploadFile(owner, { dataRoomId: room.id, name: 'a.pdf' });
      await uploadFile(owner, { dataRoomId: room.id, name: 'b.pdf' });
      const nested = await uploadFile(owner, {
        dataRoomId: room.id,
        folderId: legal.id,
        name: 'c.pdf',
      });
      await uploadFile(owner, { dataRoomId: room.id, folderId: legal.id, name: 'd.pdf' });

      const atRoot = await owner
        .patch(`/api/files/${a.id}/rename`)
        .send({ name: 'b.pdf' })
        .expect(409);
      const inFolder = await owner
        .patch(`/api/files/${nested.id}/rename`)
        .send({ name: 'd.pdf' })
        .expect(409);

      for (const res of [atRoot, inFolder]) {
        expect(res.body.error).toEqual({
          code: 'CONFLICT',
          message: 'A file with this name already exists in this location',
        });
      }
      expect((await contents(owner, room.id)).files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    });

    it('allows a name used by a file elsewhere', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const legal = await createFolder(owner, room.id, 'Legal');
      await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      const nested = await uploadFile(owner, {
        dataRoomId: room.id,
        folderId: legal.id,
        name: 'draft.pdf',
      });

      await owner.patch(`/api/files/${nested.id}/rename`).send({ name: 'nda.pdf' }).expect(200);
    });

    it('rejects a blank or too long name', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const file = await uploadFile(owner, { dataRoomId: room.id, name: 'a.pdf' });

      for (const name of ['', '   ', 'x'.repeat(256)]) {
        const res = await owner.patch(`/api/files/${file.id}/rename`).send({ name }).expect(400);
        expect(res.body.error.details).toEqual([{ field: 'name', message: expect.any(String) }]);
      }
    });
  });

  describe('view link', () => {
    it('is a signed link to the stored content that expires within a minute', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const file = await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' }, pdf('nda'));

      const res = await owner.get(`/api/files/${file.id}/view`).expect(200);

      expect(res.body).toEqual({ success: true, data: { url: expect.any(String) } });
      expect(storage.objectAt(res.body.data.url)?.content).toEqual(pdf('nda'));
      const expiresAt = Number(new URL(res.body.data.url).searchParams.get('expires'));
      expect(expiresAt - Date.now()).toBeLessThanOrEqual(60_000);
    });
  });

  describe('delete', () => {
    it('removes the file and its stored content', async () => {
      const { newUser, storage } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const file = await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      await uploadFile(owner, { dataRoomId: room.id, name: 'kept.pdf' }, pdf('kept'));

      const res = await owner.delete(`/api/files/${file.id}`).expect(204);

      expect(res.text).toBe('');
      expect((await contents(owner, room.id)).files.map((f) => f.name)).toEqual(['kept.pdf']);
      expect([...storage.objects.values()].map((o) => o.content)).toEqual([pdf('kept')]);
      await owner.get(`/api/files/${file.id}/view`).expect(404);
    });

    it('still removes the record when storage fails, and logs the failure', async () => {
      const { newUser, storage, logs } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const file = await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
      storage.failRemove = true;

      await owner.delete(`/api/files/${file.id}`).expect(204);

      expect((await contents(owner, room.id)).files).toEqual([]);
      expect(logs.join('\n')).toContain('Storage is unavailable');
    });
  });

  describe('of another user', () => {
    it('can not be viewed, renamed or deleted, and look exactly like files that do not exist', async () => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const stranger = newUser();
      const room = await createDataRoom(owner);
      const file = await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });

      for (const id of [file.id, missing]) {
        const responses = [
          await stranger.get(`/api/files/${id}/view`).expect(404),
          await stranger.patch(`/api/files/${id}/rename`).send({ name: 'mine.pdf' }).expect(404),
          await stranger.delete(`/api/files/${id}`).expect(404),
        ];
        for (const res of responses) {
          expect(res.body).toEqual({
            success: false,
            error: { code: 'NOT_FOUND', message: 'File not found' },
          });
        }
      }

      expect((await contents(owner, room.id)).files.map((f) => f.name)).toEqual(['nda.pdf']);
      await owner.get(`/api/files/${file.id}/view`).expect(200);
    });
  });
});
