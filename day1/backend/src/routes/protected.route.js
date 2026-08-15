const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const contactRoute = require("../services/contacts/contact.route");
const notificationRoute = require("../services/notification/notification.route");

const protectedRoute = express.Router();

protectedRoute.get("/dashboard", authenticate, (req, res) => {
  res.status(200).json({
    message: "Welcome to your protected dashboard",
    user: {
      userId: req.user.userId,
      email: req.user.email,
    },
  });
});

protectedRoute.use("/contacts", contactRoute);
protectedRoute.use("/notifications", notificationRoute);

module.exports = protectedRoute;
