const db = require("../../config/db");
const { contactsTable } = require("../../config/schema");
const { and, eq } = require("drizzle-orm");

const sanitizeContact = (contact) => ({
  id: contact.id,
  name: contact.name,
  email: contact.email,
  phone: contact.phone,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

const getContactById = async (req, res) => {
  try {
    const contactId = Number(req.params.id);

    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.id, contactId),
          eq(contactsTable.userId, req.user.userId)
        )
      )
      .limit(1);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({ contact: sanitizeContact(contact) });
  } catch (err) {
    console.log(err, "get contact error");
    res.status(500).json({ message: "Internal server error" });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.user.userId));

    res.status(200).json({ contacts: contacts.map(sanitizeContact) });
  } catch (err) {
    console.log(err, "get contacts error");
    res.status(500).json({ message: "Internal server error" });
  }
};

const createContact = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const [contact] = await db
      .insert(contactsTable)
      .values({
        userId: req.user.userId,
        name,
        email,
        phone: phone || null,
      })
      .returning();

    res.status(201).json({
      message: "Contact created successfully",
      contact: sanitizeContact(contact),
    });
  } catch (err) {
    console.log(err, "create contact error");
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateContact = async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const [existingContact] = await db
      .select()
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.id, contactId),
          eq(contactsTable.userId, req.user.userId)
        )
      )
      .limit(1);

    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const [contact] = await db
      .update(contactsTable)
      .set({
        name,
        email,
        phone: phone || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contactsTable.id, contactId),
          eq(contactsTable.userId, req.user.userId)
        )
      )
      .returning();

    res.status(200).json({
      message: "Contact updated successfully",
      contact: sanitizeContact(contact),
    });
  } catch (err) {
    console.log(err, "update contact error");
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteContact = async (req, res) => {
  try {
    const contactId = Number(req.params.id);

    const [existingContact] = await db
      .select()
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.id, contactId),
          eq(contactsTable.userId, req.user.userId)
        )
      )
      .limit(1);

    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await db
      .delete(contactsTable)
      .where(
        and(
          eq(contactsTable.id, contactId),
          eq(contactsTable.userId, req.user.userId)
        )
      );

    res.status(200).json({ message: "Contact deleted successfully" });
  } catch (err) {
    console.log(err, "delete contact error");
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
};
