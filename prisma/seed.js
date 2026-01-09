// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 先清空（开发环境这么做 OK）
  await prisma.pendingApproval.deleteMany();
  await prisma.session.deleteMany();
  await prisma.message.deleteMany();
  await prisma.vipGuest.deleteMany();

  // 一些示例 VIP 数据
  const guests = [
    {
      vipNumber: "10001",
      firstName: "Alex",
      lastName: "Wong",
      preferredName: "Alex",
      birthdayMd: "0323",
    },
    {
      vipNumber: "10002",
      firstName: "Jayvion",
      lastName: "Simon",
      preferredName: "Jayvion",
      birthdayMd: "0115",
    },
    {
      vipNumber: "10003",
      firstName: "Joye",
      lastName: "Duan",
      preferredName: "Joye",
      birthdayMd: "0818",
    },
    {
      vipNumber: "10004",
      firstName: "Emily",
      lastName: "Chan",
      preferredName: "Emily",
      birthdayMd: null, // 没有生日记录的情况
    },
    {
      vipNumber: "10005",
      firstName: "Michael",
      lastName: "Lee",
      preferredName: "Mr. Lee",
      birthdayMd: "1225",
    },
  ];

  for (const g of guests) {
    await prisma.vipGuest.create({
      data: {
        vipNumber: g.vipNumber,
        fullName: `${g.firstName} ${g.lastName}`,
        firstName: g.firstName,
        lastName: g.lastName,
        preferredName: g.preferredName,
        birthdayMd: g.birthdayMd || null,
      },
    });
  }

  console.log("Seeding done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
