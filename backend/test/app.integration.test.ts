import { allowedOrigin, createDataRoom, createFolder, createTestApp, uploadFile } from './app';

describe('the app', () => {
  it('answers the health check without authentication', async () => {
    const { anonymous } = createTestApp();

    const res = await anonymous().get('/api/health').expect(200);

    expect(res.body).toEqual({ success: true, data: { status: 'OK' } });
  });

  it('sets security headers and rate limit headers', async () => {
    const { anonymous } = createTestApp();

    const res = await anonymous().get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['ratelimit-limit']).toBe('100');
  });

  it('allows cross-origin requests from the configured origins only', async () => {
    const { anonymous } = createTestApp();

    const allowed = await anonymous().get('/api/health').set('Origin', allowedOrigin);
    const other = await anonymous().get('/api/health').set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers an unknown route with a NOT_FOUND error', async () => {
    const { newUser } = createTestApp();

    const res = await newUser().get('/api/nothing-here').expect(404);

    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  it('answers an unexpected failure with an INTERNAL error that reveals nothing', async () => {
    const { newUser, storage } = createTestApp();
    const owner = newUser();
    const room = await createDataRoom(owner);
    const file = await uploadFile(owner, { dataRoomId: room.id, name: 'nda.pdf' });
    storage.objects.clear();

    const res = await owner.get(`/api/files/${file.id}/view`).expect(500);

    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });

  describe('removed endpoints', () => {
    it.each([
      ['GET', '/'],
      ['GET', '/api/test'],
      ['GET', '/api/data-rooms/:room'],
      ['PUT', '/api/data-rooms/:room'],
      ['GET', '/api/folders?dataRoomId=:room'],
      ['GET', '/api/folders/:folder/contents'],
      ['GET', '/api/folders/:folder/contents?includeFiles=false'],
      ['GET', '/api/folders/:folder/tree'],
      ['PATCH', '/api/folders/:folder/move'],
      ['GET', '/api/files?dataRoomId=:room'],
      ['GET', '/api/files?folderId=:folder'],
    ])('%s %s answers 404', async (method, path) => {
      const { newUser } = createTestApp();
      const owner = newUser();
      const room = await createDataRoom(owner);
      const folder = await createFolder(owner, room.id, 'Legal');
      const url = path.replace(':room', room.id).replace(':folder', folder.id);

      const res = await owner[method.toLowerCase() as 'get'](url).send({
        name: 'Renamed',
        newParentId: null,
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    });
  });

  it('never writes emails or tokens to the logs', async () => {
    const { newUser, storage, logs, anonymous } = createTestApp();
    const owner = newUser('Ada Lovelace');
    const room = await createDataRoom(owner);
    const folder = await createFolder(owner, room.id, 'Legal');
    const file = await uploadFile(owner, {
      dataRoomId: room.id,
      folderId: folder.id,
      name: 'nda.pdf',
    });
    await owner.get(`/api/files/${file.id}/view`).expect(200);
    await owner.post('/api/data-rooms').send({ name: room.name }).expect(409);
    await anonymous()
      .get('/api/auth/me')
      .auth(`${owner.token}-tampered`, { type: 'bearer' })
      .expect(401);
    storage.failRemove = true;
    await owner.delete(`/api/folders/${folder.id}`).expect(204);
    storage.objects.clear();
    const other = await uploadFile(owner, { dataRoomId: room.id, name: 'other.pdf' });
    storage.objects.clear();
    await owner.get(`/api/files/${other.id}/view`).expect(500);

    const output = logs.join('\n');
    expect(logs.length).toBeGreaterThan(10);
    expect(output).toContain('Storage is unavailable');
    expect(output).not.toContain(owner.email);
    expect(output).not.toContain(owner.token);
  });
});
