// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding VipGuest data...");

  // 先清空一下（开发环境方便反复改）
  await prisma.vipGuest.deleteMany();

  await prisma.vipGuest.createMany({
    data: [
      {
        vipNumber: "10001",
        fullName: "Alex Lee",
        preferredName: "Alex",
      },
      {
        vipNumber: "10002",
        fullName: "Catherine Wong",
        preferredName: "Cathy",
      },
      {
        vipNumber: "10003",
        fullName: "Michael Chan",
        preferredName: "Mike",
      },
      {
        vipNumber: "10004",
        fullName: "Liang Zhang",
        preferredName: "Mr. Zhang",
      },
      {
        vipNumber: "10005",
        fullName: "Mei Lin",
        preferredName: "Ms. Lin",
      },
    ],
  });

  console.log("Seed finished.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
