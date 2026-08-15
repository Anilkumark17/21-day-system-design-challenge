const { verifyToken } = require("../../utils/jwt");
const { addClient, removeClient, writeEvent } = require("./notification.service");

const streamNotifications = (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let user;

  try {
    user = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const userId = user.userId;
  addClient(userId, res);

  writeEvent(res, "connected", { message: "SSE connected" });

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
  });
};

module.exports = {
  streamNotifications,
};
