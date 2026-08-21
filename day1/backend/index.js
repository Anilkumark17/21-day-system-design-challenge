require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const authRoute = require("./src/services/auth/auth.route");
const protectedRoute = require("./src/routes/protected.route");
const { setupWebSocket } = require("./src/websocket/socket");
const { startCronJobs } = require("./src/cron");
const rateLimit = require("./rate-limiter/rate-limiter-middleware");
const { verifyToken } = require("./src/utils/jwt");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

const getRateLimitKey = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const user = verifyToken(authHeader.split(" ")[1]);
      return `user:${user.userId}`;
    } catch {
      // Fall through to IP-based limiting for invalid tokens.
    }
  }

  return `ip:${req.ip}`;
};

app.use(
  "/api",
  rateLimit({
    capacity: Number(process.env.RATE_LIMIT_CAPACITY || 5),
    refillRate: Number(process.env.RATE_LIMIT_REFILL_RATE || 1),
    maxQueueSize: Number(process.env.RATE_LIMIT_MAX_QUEUE || 20),
    maxWaitMs: Number(process.env.RATE_LIMIT_MAX_WAIT_MS || 5000),
    keyFn: getRateLimitKey,
  })
);

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
