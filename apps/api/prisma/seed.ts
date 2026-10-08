import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "password123";
const TEST_CIRCLE_INVITE_CODE = "TESTCLE1";

async function upsertUser(email: string, displayName: string) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName, passwordHash },
  });
}

async function main() {
  const ada = await upsertUser("ada@test.dev", "Ada");
  const bob = await upsertUser("bob@test.dev", "Bob");

  const circle = await prisma.circle.upsert({
    where: { inviteCode: TEST_CIRCLE_INVITE_CODE },
    update: {},
    create: {
      name: "Cercle de test",
      ownerId: ada.id,
      inviteCode: TEST_CIRCLE_INVITE_CODE,
      members: { create: [{ userId: ada.id }, { userId: bob.id }] },
    },
  });

  const homeExists = await prisma.place.findFirst({
    where: { circleId: circle.id, name: "Maison" },
  });
  if (!homeExists) {
    await prisma.place.create({
      data: {
        circleId: circle.id,
        name: "Maison",
        latitude: 48.8566,
        longitude: 2.3522,
        radiusMeters: 150,
      },
    });
  }

  console.log("\nSeed OK — comptes de test (mot de passe pour tous : %s) :", TEST_PASSWORD);
  console.log(`  - ${ada.email}`);
  console.log(`  - ${bob.email}`);
  console.log(`Cercle "${circle.name}" (code d'invitation : ${circle.inviteCode})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
