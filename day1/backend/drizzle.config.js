const { defineConfig } = require("drizzle-kit");
require("dotenv").config();

module.exports = defineConfig({
  schema: "./src/config/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
