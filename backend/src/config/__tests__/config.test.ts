import { loadConfig } from '..';

const env = {
  DATABASE_URL: 'postgresql://localhost/db',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  ALLOWED_ORIGINS: 'http://localhost:3000, https://app.example.com',
};

describe('loadConfig', () => {
  it('parses the environment', () => {
    expect(loadConfig({ ...env, PORT: '4000', NODE_ENV: 'production' })).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-role',
      allowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
      port: 4000,
      nodeEnv: 'production',
    });
  });

  it('defaults the port and environment', () => {
    expect(loadConfig(env)).toMatchObject({ port: 3001, nodeEnv: 'development' });
  });

  it('names every missing variable in one error', () => {
    const { DATABASE_URL: _db, ALLOWED_ORIGINS: _origins, ...rest } = env;

    expect(() => loadConfig(rest)).toThrow('Missing required environment variables: DATABASE_URL, ALLOWED_ORIGINS');
  });

  it('does not require the Supabase anon key', () => {
    expect(() => loadConfig(env)).not.toThrow();
  });
});
