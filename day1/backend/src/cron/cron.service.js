const db = require("../config/db");
const {
  usersTable,
  contactsTable,
  messagesTable,
} = require("../config/schema");
const { and, count, eq, gte, lt } = require("drizzle-orm");

const getRecentMessageCountForUser = async (userEmail, hours = 24) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [result] = await db
    .select({ value: count() })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.receiverEmail, userEmail),
        gte(messagesTable.createdAt, since)
      )
    );

  return Number(result?.value || 0);
};

const getAllUsers = async () => {
  return db.select().from(usersTable);
};

const deleteOldMessages = async (retentionDays = 90) => {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(messagesTable)
    .where(lt(messagesTable.createdAt, cutoff))
    .returning({ id: messagesTable.id });

  return deleted.length;
};

const getAppStats = async () => {
  const [[users], [contacts], [messages]] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(contactsTable),
    db.select({ value: count() }).from(messagesTable),
  ]);

  return {
    users: Number(users?.value || 0),
    contacts: Number(contacts?.value || 0),
    messages: Number(messages?.value || 0),
  };
};

module.exports = {
  getRecentMessageCountForUser,
  getAllUsers,
  deleteOldMessages,
  getAppStats,
};
