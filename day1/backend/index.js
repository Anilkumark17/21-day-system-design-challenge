require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const authRoute = require("./src/services/auth/auth.route");
const protectedRoute = require("./src/routes/protected.route");
const { setupWebSocket } = require("./src/websocket/socket");
const { startCronJobs } = require("./src/cron");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("API is running");
});

app.use("/auth", authRoute);
app.use("/api", protectedRoute);

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  startCronJobs();
});
