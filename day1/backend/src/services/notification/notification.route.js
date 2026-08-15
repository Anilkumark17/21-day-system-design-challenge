const express = require("express");
const { streamNotifications } = require("./notification.controller");

const notificationRoute = express.Router();

notificationRoute.get("/stream", streamNotifications);

module.exports = notificationRoute;
