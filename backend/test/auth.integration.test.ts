import { createTestApp } from './app';

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const { anonymous } = createTestApp();

    const res = await anonymous().get('/api/auth/me').expect(401);

    expect(res.body).toEqual({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: expect.any(String) },
    });
  });

  it('rejects a token the verifier does not accept', async () => {
    const { anonymous } = createTestApp();

    const res = await anonymous()
      .get('/api/auth/me')
      .auth('forged', { type: 'bearer' })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('creates the account on the first request', async () => {
    const { newUser } = createTestApp();
    const user = newUser('Ada Lovelace');

    const res = await user.get('/api/auth/me').expect(200);

    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        email: user.email,
        name: 'Ada Lovelace',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it('names the account after the email when the identity has no name', async () => {
    const { newUser } = createTestApp();
    const user = newUser(null);

    const res = await user.get('/api/auth/me').expect(200);

    expect(res.body.data.name).toBe(user.email.split('@')[0]);
  });

  it('finds the same account on later requests', async () => {
    const { newUser } = createTestApp();
    const user = newUser();
    const first = await user.get('/api/auth/me').expect(200);

    const second = await user.get('/api/auth/me').expect(200);

    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it.each([
    ['GET', '/api/data-rooms'],
    ['GET', '/api/data-rooms/any/contents'],
    ['POST', '/api/folders'],
    ['DELETE', '/api/files/any'],
  ])('guards %s %s', async (method, url) => {
    const { anonymous } = createTestApp();

    const res = await anonymous()[method.toLowerCase() as 'get'](url).expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['GET', '/api/auth/me'],
    ['GET', '/api/data-rooms'],
    ['POST', '/api/folders'],
    ['GET', '/api/files/any/view'],
  ])('verifies the token exactly once for %s %s', async (method, url) => {
    const { newUser, tokenVerifier } = createTestApp();
    const user = newUser();
    tokenVerifier.calls = 0;

    await user[method.toLowerCase() as 'get'](url);

    expect(tokenVerifier.calls).toBe(1);
  });
});
