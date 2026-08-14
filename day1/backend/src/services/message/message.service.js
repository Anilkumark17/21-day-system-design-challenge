const db = require("../../config/db");
const {
  contactsTable,
  messagesTable,
  usersTable,
} = require("../../config/schema");
const { and, asc, eq, or } = require("drizzle-orm");

const formatMessage = (msg) => ({
  id: msg.id,
  senderId: msg.senderId,
  content: msg.content,
  receiverEmail: msg.receiverEmail,
  createdAt: msg.createdAt,
});

const getContactForUser = async (userId, contactId) => {
  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(
      and(eq(contactsTable.id, contactId), eq(contactsTable.userId, userId))
    )
    .limit(1);

  return contact || null;
};

const findUserByEmail = async (email) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  return user || null;
};

const findContactByEmail = async (userId, email) => {
  const [contact] = await db
    .select()
    .from(contactsTable)
    .where(
      and(eq(contactsTable.userId, userId), eq(contactsTable.email, email))
    )
    .limit(1);

  return contact || null;
};

const getContactMessages = async (userId, contactId) => {
  const contact = await getContactForUser(userId, contactId);
  if (!contact) return null;

  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const contactUser = await findUserByEmail(contact.email);

  const conversationFilters = [
    and(
      eq(messagesTable.senderId, userId),
      eq(messagesTable.receiverEmail, contact.email)
    ),
  ];

  if (contactUser && currentUser) {
    conversationFilters.push(
      and(
        eq(messagesTable.senderId, contactUser.id),
        eq(messagesTable.receiverEmail, currentUser.email)
      )
    );
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(or(...conversationFilters))
    .orderBy(asc(messagesTable.createdAt));

  return messages.map(formatMessage);
};

const saveMessage = async ({ userId, contactId, receiverEmail, content }) => {
  const contact = await getContactForUser(userId, contactId);
  if (!contact || contact.email !== receiverEmail) return null;

  const [message] = await db
    .insert(messagesTable)
    .values({
      senderId: userId,
      contactId,
      receiverEmail,
      content,
    })
    .returning();

  return formatMessage(message);
};

const getReceiverDeliveryTarget = async (senderEmail, receiverEmail) => {
  const receiverUser = await findUserByEmail(receiverEmail);

  if (!receiverUser) {
    return null;
  }

  const receiverContact = await findContactByEmail(receiverUser.id, senderEmail);

  if (!receiverContact) {
    return null;
  }

  return {
    userId: receiverUser.id,
    contactId: receiverContact.id,
  };
};

module.exports = {
  getContactMessages,
  saveMessage,
  getReceiverDeliveryTarget,
};
