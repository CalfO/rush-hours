import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.hello.upsert({
    where: { key: 'hello' },
    update: { value: 'Hello World!' },
    create: { key: 'hello', value: 'Hello World!' },
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
