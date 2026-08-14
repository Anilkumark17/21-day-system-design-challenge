const express = require("express");
const { register, login, getProfile } = require("./auth.controller");
const { authenticate } = require("../../middleware/auth.middleware");

const authRoute = express.Router();

authRoute.post("/register", register);
authRoute.post("/login", login);
authRoute.get("/me", authenticate, getProfile);

module.exports = authRoute;
