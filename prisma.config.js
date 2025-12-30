const { defineConfig } = require("@prisma/internals");

// 本地没有环境变量时，默认用 dev.db；
// 在服务器上会用 .env 里的 DATABASE_URL 指向 prod.db
const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";

module.exports = defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
