// prisma/seed.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // 1) 清掉旧的测试数据（只删我们这几个测试 VIP，不影响别的）
  await prisma.vipGuest.deleteMany({
    where: {
      vipNumber: {
        in: ["10001", "10002", "10003", "10004", "10005"],
      },
    },
  });

  // 2) 插入 5 条带「生日 + 偏好 + 忌讳」的 VIP 假数据
  await prisma.vipGuest.createMany({
    data: [
      {
        vipNumber: "10001",
        fullName: "Alex Lee",
        preferredName: "Alex",
        birthdayMd: "0323", // 3月23日

        prefStay: "High floor, lake view, quiet room",
        prefDining: "Vegetarian, no spicy, lactose-free",
        prefTransport: "Prefers hotel limousine or Mercedes S-Class",
        prefCulturePrivacy:
          "Avoid number 4; gifts should not contain leather or fur",
        prefOther: "Enjoys contemporary art and private gallery tours",

        tier: "Diamond",
        room: "1808",
        checkInDate: new Date("2026-01-05T15:00:00Z"),
        checkOutDate: null,
        segment: "Leisure",
        statusLabel: "Checked in",
      },
      {
        vipNumber: "10002",
        fullName: "Catherine Wong",
        preferredName: "Cathy",
        birthdayMd: "0707", // 7月7日

        prefStay: "Near elevator, soft mattress, extra pillows",
        prefDining: "No seafood, low sodium, likes fruit platters",
        prefTransport: "Taxi only, no ride-hailing apps",
        prefCulturePrivacy:
          "Avoid taking photos during meals; do not mention company name publicly",
        prefOther: "Likes fresh flowers in room, especially white lilies",

        tier: "Gold",
        room: "2305",
        checkInDate: new Date("2026-01-06T10:30:00Z"),
        checkOutDate: new Date("2026-01-08T12:00:00Z"),
        segment: "Business",
        statusLabel: "Checked in",
      },
      {
        vipNumber: "10003",
        fullName: "Michael Chan",
        preferredName: "Mike",
        birthdayMd: "1215", // 12月15日

        prefStay: "Late checkout, extra towels, corner suite preferred",
        prefDining:
          "Enjoys tasting menus, fine dining, no coriander (cilantro)",
        prefTransport: "Self-drive; needs reserved parking space close to lobby",
        prefCulturePrivacy:
          "Avoid number 13; do not use name in any public marketing",
        prefOther:
          "Interested in spa & wellness programs, prefers evening appointments",

        tier: "Platinum",
        room: "—",
        checkInDate: null,
        checkOutDate: new Date("2025-12-30T11:00:00Z"),
        segment: "Leisure",
        statusLabel: "Checked out",
      },
      {
        vipNumber: "10004",
        fullName: "Yuki Tanaka",
        preferredName: "Yuki",
        birthdayMd: "0419", // 4月19日

        prefStay: "Low floor, close to spa, firm pillows",
        prefDining:
          "Japanese cuisine, no beef; prefers light breakfast in lounge",
        prefTransport: "Hotel shuttle to nearby shopping areas",
        prefCulturePrivacy:
          "Avoid room numbers containing 4; no surprise celebrations",
        prefOther:
          "Enjoys art workshops and cultural experiences with local artists",

        tier: "Chairman",
        room: "3001",
        checkInDate: new Date("2026-01-04T14:00:00Z"),
        checkOutDate: new Date("2026-01-09T12:00:00Z"),
        segment: "Leisure",
        statusLabel: "Checked in",
      },
      {
        vipNumber: "10005",
        fullName: "David Li",
        preferredName: "David",
        birthdayMd: "0910", // 9月10日

        prefStay: "High floor, city view, desk with good task lighting",
        prefDining:
          "Business dinners in private rooms; no shellfish; prefers red wine",
        prefTransport:
          "Airport pick-up with name board; prefers black sedan only",
        prefCulturePrivacy:
          "Do not mention his position in front of other guests; avoid public greetings",
        prefOther:
          "Likes late-night in-room dining; may request meeting room on short notice",

        tier: "Black",
        room: "2602",
        checkInDate: new Date("2025-12-28T18:30:00Z"),
        checkOutDate: null,
        segment: "Business",
        statusLabel: "Not checked in",
      },
    ],
  });

  console.log("✅ Seeded 5 fake VipGuest records.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
