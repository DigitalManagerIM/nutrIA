import { PrismaClient } from '@prisma/client';
import { achievements } from './achievements';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: achievement,
      create: achievement,
    });
  }

  console.log(`✅ ${achievements.length} achievements seeded`);
  console.log('🦦 Database ready!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
