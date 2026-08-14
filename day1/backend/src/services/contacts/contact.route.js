const express = require("express");
const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
} = require("./contact.controller");
const { authenticate } = require("../../middleware/auth.middleware");

const contactRoute = express.Router();

contactRoute.use(authenticate);

contactRoute.get("/", getContacts);
contactRoute.get("/:id", getContactById);
contactRoute.post("/", createContact);
contactRoute.put("/:id", updateContact);
contactRoute.delete("/:id", deleteContact);

module.exports = contactRoute;
