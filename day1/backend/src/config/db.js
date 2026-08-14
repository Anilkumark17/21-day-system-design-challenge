require("dotenv").config();

const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { usersTable, contactsTable, messagesTable } = require("./schema");
const sql = neon(process.env.DATABASE_URL);

const db = drizzle(sql, {
  schema: {
    usersTable,
    contactsTable,
    messagesTable,
  },
});

module.exports = db;