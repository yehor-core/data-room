import { PrismaClient } from '@prisma/client';
import { createEmptyDatabase, migrateDeploy } from './db';

const serverUrl = () => process.env.DATABASE_URL!;

describe('migrations', () => {
  it('apply to an empty database', async () => {
    const url = await createEmptyDatabase(serverUrl(), 'migrations_from_empty');

    await migrateDeploy(url);

    const prisma = new PrismaClient({ datasourceUrl: url });
    try {
      const owner = await prisma.user.create({ data: { email: 'owner@example.com' } });
      const room = await prisma.dataRoom.create({ data: { name: 'Deal', ownerId: owner.id } });
      expect(room.name).toBe('Deal');
    } finally {
      await prisma.$disconnect();
    }
  });
});
