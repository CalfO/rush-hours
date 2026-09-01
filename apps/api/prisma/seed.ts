import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: { username: 'user', role: Role.USER },
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', role: Role.ADMIN },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
