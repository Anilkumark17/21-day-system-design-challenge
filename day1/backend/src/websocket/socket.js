const { WebSocketServer } = require("ws");
const { verifyToken } = require("../utils/jwt");
const {
  getContactMessages,
  saveMessage,
  getReceiverDeliveryTarget,
} = require("../services/message/message.service");
const { sendNotification } = require("../services/notification/notification.service");

const rooms = new Map();

const getRoomKey = (userId, contactId) => `${userId}:${contactId}`;

const addClient = (roomKey, ws) => {
  if (!rooms.has(roomKey)) rooms.set(roomKey, new Set());
  rooms.get(roomKey).add(ws);
};

const removeClient = (roomKey, ws) => {
  rooms.get(roomKey)?.delete(ws);
};

const broadcast = (roomKey, payload) => {
  const clients = rooms.get(roomKey);
  if (!clients) return;

  const data = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
};

const send = (ws, payload) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
};

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const token = new URL(req.url, "http://localhost").searchParams.get("token");

    if (!token) {
      ws.close();
      return;
    }

    let user;

    try {
      user = verifyToken(token);
    } catch {
      ws.close();
      return;
    }

    ws.userId = user.userId;
    ws.userEmail = user.email;
    ws.roomKey = null;

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "join") {
          const contactId = Number(data.contactId);
          const roomKey = getRoomKey(user.userId, contactId);

          if (ws.roomKey) removeClient(ws.roomKey, ws);

          ws.roomKey = roomKey;
          ws.contactId = contactId;
          addClient(roomKey, ws);

          const messages = await getContactMessages(user.userId, contactId);

          if (messages === null) {
            send(ws, { type: "error", message: "Contact not found" });
            return;
          }

          send(ws, { type: "history", messages });
          return;
        }

        if (data.type === "send") {
          const contactId = Number(data.contactId);
          const content = data.content?.trim();
          const receiverEmail = data.receiverEmail;

          if (!contactId || !content || !receiverEmail) return;

          const message = await saveMessage({
            userId: user.userId,
            contactId,
            receiverEmail,
            content,
          });

          if (!message) {
            send(ws, { type: "error", message: "Contact not found" });
            return;
          }

          const payload = { type: "message", message };

          broadcast(getRoomKey(user.userId, contactId), payload);

          const receiverTarget = await getReceiverDeliveryTarget(
            user.email,
            receiverEmail
          );

          if (receiverTarget) {
            broadcast(
              getRoomKey(receiverTarget.userId, receiverTarget.contactId),
              payload
            );

            sendNotification(receiverTarget.userId, {
              type: "new_message",
              from: user.email,
              preview: content,
              contactId: receiverTarget.contactId,
              messageId: message.id,
            });
          }
        }
      } catch (err) {
        console.log(err, "websocket error");
      }
    });

    ws.on("close", () => {
      if (ws.roomKey) removeClient(ws.roomKey, ws);
    });
  });
};

module.exports = { setupWebSocket };
