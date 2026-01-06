// prisma/seed-vipguests.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const guests = [
    {
      vipNumber: "10001",
      fullName: "Jayvion Simon",
      preferredName: "张先生",
      tier: "Diamond",
      birthday: new Date("1984-05-12"),
      room: "304",
      checkInDate: new Date("2026-01-01"),
      checkOutDate: new Date("2026-01-05"),
      segment: "Leisure",
      statusLabel: "Checked In",
      mobilePhone: "+85361234567",
      whatsappNumber: "+85361234567",
      wechatId: "jayvion_simon",
      email: "jayvion.simon@example.com",
      primaryLanguage: "zh-CN",
      preferredChannel: "wechat",
      stayPreference: "High floor, quiet room, firm mattress, feather-free pillows.",
      diningPreference: "No seafood, light seasoning, prefers Chinese breakfast.",
      transportPreference: "Chinese-speaking driver, 7-seater van for airport transfer.",
      culturePrivacyPreference:
        "Prefers minimal room knocks, communicate via message first.",
      otherPreferences: "Enjoys jazz, likes late check-out when possible.",
    },
    {
      vipNumber: "10002",
      fullName: "Catherine Li",
      preferredName: "Cathy",
      tier: "Platinum",
      birthday: new Date("1990-03-18"),
      room: "1812",
      checkInDate: new Date("2026-01-03"),
      checkOutDate: new Date("2026-01-06"),
      segment: "Business",
      statusLabel: "Checked In",
      mobilePhone: "+85291234567",
      whatsappNumber: "+85291234567",
      email: "catherine.li@example.com",
      primaryLanguage: "en",
      preferredChannel: "whatsapp",
      stayPreference: "King bed, high floor, turn-down service every night.",
      diningPreference: "Vegetarian, no onion/garlic, enjoys room service.",
      transportPreference: "Prefers limousine service, airport pick-up and drop-off.",
      culturePrivacyPreference:
        "Ok with proactive recommendations via WhatsApp.",
      otherPreferences: "Likes spa reservations in the evening.",
    },
    {
      vipNumber: "10003",
      fullName: "Daniel Wong",
      preferredName: "Mr. Wong",
      tier: "Gold",
      birthday: new Date("1978-11-02"),
      segment: "Leisure",
      statusLabel: "Checked Out",
      mobilePhone: "+85292345678",
      email: "daniel.wong@example.com",
      primaryLanguage: "zh-HK",
      preferredChannel: "wechat",
      stayPreference: "Close to elevator, non-smoking floor.",
      diningPreference: "Enjoys Cantonese cuisine, no coriander.",
      transportPreference: "Taxi is fine, no special request.",
      culturePrivacyPreference:
        "Prefers phone calls over text for urgent matters.",
      otherPreferences: "Interested in show tickets and dining offers.",
    },
    {
      vipNumber: "10004",
      fullName: "Melanie Noble",
      preferredName: "Mel",
      tier: "Diamond",
      birthday: new Date("1989-09-25"),
      room: "1208",
      checkInDate: new Date("2026-01-02"),
      checkOutDate: new Date("2026-01-07"),
      segment: "Leisure",
      statusLabel: "Checked In",
      mobilePhone: "+1-310-555-1234",
      email: "melanie.noble@example.com",
      primaryLanguage: "en",
      preferredChannel: "whatsapp",
      stayPreference: "Suite, late check-out, extra towels and bath amenities.",
      diningPreference: "Gluten-free, prefers western breakfast.",
      transportPreference: "Airport limo, happy to share itinerary in advance.",
      culturePrivacyPreference:
        "Enjoys personalized welcome notes and amenity cards.",
      otherPreferences: "Loves art exhibitions and quiet lounge spaces.",
    },
    {
      vipNumber: "10005",
      fullName: "Reece Chung",
      preferredName: "Reece",
      tier: "Gold",
      birthday: new Date("1993-07-14"),
      room: "905",
      checkInDate: new Date("2026-01-01"),
      checkOutDate: new Date("2026-01-03"),
      segment: "Leisure",
      statusLabel: "Checked In",
      mobilePhone: "+86-13800001111",
      wechatId: "reece_chung",
      email: "reece.chung@example.com",
      primaryLanguage: "zh-CN",
      preferredChannel: "wechat",
      stayPreference: "Twin beds, mid-floor, city view.",
      diningPreference: "No spicy food, prefers buffet breakfast.",
      transportPreference: "Hotel shuttle is fine, sometimes uses taxi.",
      culturePrivacyPreference:
        "Prefers text messages instead of phone calls.",
      otherPreferences: "Travels with friends, likes nightlife suggestions.",
    },
  ];

  for (const guest of guests) {
    await prisma.vipGuest.upsert({
      where: { vipNumber: guest.vipNumber },
      update: guest,
      create: guest,
    });
  }

  console.log("✅ Seeded VIP guests successfully");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding VIP guests", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
