const clients = new Map();

const addClient = (userId, res) => {
  const key = String(userId);

  if (!clients.has(key)) {
    clients.set(key, new Set());
  }

  clients.get(key).add(res);
};

const removeClient = (userId, res) => {
  const key = String(userId);
  const userClients = clients.get(key);

  if (!userClients) {
    return;
  }

  userClients.delete(res);

  if (userClients.size === 0) {
    clients.delete(key);
  }
};

const writeEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const sendNotification = (userId, payload) => {
  const key = String(userId);
  const userClients = clients.get(key);

  if (!userClients || userClients.size === 0) {
    return;
  }

  const event = payload.type || "notification";
  const deadClients = [];

  userClients.forEach((res) => {
    try {
      writeEvent(res, event, payload);
    } catch {
      deadClients.push(res);
    }
  });

  deadClients.forEach((res) => userClients.delete(res));

  if (userClients.size === 0) {
    clients.delete(key);
  }
};

module.exports = {
  addClient,
  removeClient,
  writeEvent,
  sendNotification,
};
