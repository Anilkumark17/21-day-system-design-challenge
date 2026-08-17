# Server-Sent Events (SSE) Notes

A beginner-friendly guide to understanding **Server-Sent Events (SSE)**, how they differ from WebSockets, the SSE message format, and how this project uses SSE for real-time navbar notifications alongside WebSocket chat.

---

# Table of Contents

- What is SSE?
- Why SSE?
- SSE vs WebSocket
- How SSE Works
- SSE Message Format
- EventSource API
- Architecture Overview
- End-to-End Flow
- Backend Implementation
- Frontend Implementation
- Event Types
- Example Scenario
- Key Concepts
- File Structure
- How to Test
- Summary
- Key Takeaways

---

# What is SSE?

**Server-Sent Events (SSE)** is a one-way communication channel that lets the server push updates to the browser over a normal HTTP connection.

```
Server  ──────────────────────►  Browser
        (push events over HTTP)
```

Key characteristics:

- Uses normal HTTP (no WebSocket upgrade)
- **Server → client only** (the browser cannot send data back on the same stream)
- Browser API: `EventSource`
- Response type: `text/event-stream`
- Connection stays open until the client disconnects

Unlike a typical REST response that closes immediately, an SSE stream remains open so the server can keep sending events.

---

# Why SSE?

Not every real-time feature needs full two-way communication.

SSE is ideal when:

- The server needs to **push** updates to the client
- The client only needs to **listen** (not send on the same channel)
- You want to stay on standard HTTP (simpler proxies, caching rules, auth patterns)

In this project:

- **WebSocket** handles live chat (send + receive messages)
- **SSE** handles navbar notifications (alert the user when a new message arrives)

---

# SSE vs WebSocket

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | One-way (server → client) | Two-way (full-duplex) |
| Protocol | Normal HTTP | HTTP upgrade → WebSocket |
| Browser API | `EventSource` | `WebSocket` |
| Content-Type | `text/event-stream` | Binary or text frames |
| Reconnect | Built-in auto-reconnect | Manual reconnection |
| Best for | Notifications, live feeds, dashboards | Chat, games, collaboration |

## In This Project

| Feature | Technology | Purpose |
|---------|------------|---------|
| Live chat on contact page | WebSocket (`/ws`) | Send + receive messages |
| Navbar notifications | SSE (`/api/notifications/stream`) | Alert user when a new message arrives |

---

# How SSE Works

```
Browser                          Server

GET /stream?token=JWT
Connection: keep-alive
---------------------------->

                    Validate token
                    Register client
                    Keep response open

<----------------------------
event: connected
data: {"message":"SSE connected"}

<----------------------------
event: new_message
data: {"from":"alice@...","preview":"Hi!"}

<----------------------------
: heartbeat
(comment — keeps connection alive)
```

The HTTP response never ends. The server writes events whenever something happens.

---

# SSE Message Format

Each event follows this structure:

```
event: event_name
data: {"key":"value"}

```

Rules:

- `event:` — optional custom event name (defaults to `message`)
- `data:` — payload (usually JSON on one line)
- Blank line (`\n\n`) — marks the end of one event
- Lines starting with `:` — comments (used for heartbeats)

Example from this project:

```
event: new_message
data: {"type":"new_message","from":"alice@test.com","preview":"Hello!"}

```

Heartbeat (comment, ignored by EventSource listeners):

```
: heartbeat

```

---

# EventSource API

The browser opens an SSE connection with `EventSource`:

```javascript
const source = new EventSource("/api/notifications/stream?token=JWT");

source.addEventListener("connected", () => {
  console.log("SSE connected");
});

source.addEventListener("new_message", (event) => {
  const data = JSON.parse(event.data);
  console.log(data.from, data.preview);
});

source.onerror = () => {
  console.log("SSE disconnected");
};

// Cleanup
source.close();
```

Important limitations:

- `EventSource` only supports **GET** requests
- Custom headers (like `Authorization: Bearer`) are **not** supported in all browsers
- That is why this project passes the JWT as a **query parameter**: `?token=`

---

# Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Navbar → NotificationBell → useNotifications hook           │
│              ↓ EventSource                                   │
│         GET /api/notifications/stream?token=JWT              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (kept open)
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND                               │
│  notification.controller.js  → opens SSE stream              │
│  notification.service.js     → stores clients in Map         │
│                                                              │
│  When message sent via WebSocket (socket.js):                │
│    saveMessage() → sendNotification(receiverUserId, payload) │
└─────────────────────────────────────────────────────────────┘
```

---

# End-to-End Flow

## 1. User Logs In

JWT is stored in `localStorage`. The Navbar renders `NotificationBell`.

## 2. SSE Connection Opens

```javascript
// frontend/src/hooks/useNotifications.js
const source = new EventSource(`/api/notifications/stream?token=${token}`);
```

## 3. Backend Validates and Registers Client

```javascript
// notification.controller.js
user = verifyToken(token);
addClient(userId, res);  // store Express response object
writeEvent(res, "connected", { message: "SSE connected" });
```

## 4. Connection Stays Open

- Heartbeat every 30 seconds: `: heartbeat\n\n`
- On tab close: `removeClient(userId, res)`

## 5. Someone Sends a Message (WebSocket)

```javascript
// socket.js — after message saved
sendNotification(receiverTarget.userId, {
  type: "new_message",
  from: user.email,
  preview: content,
  contactId: receiverTarget.contactId,
  messageId: message.id,
});
```

## 6. Receiver Gets Notification Instantly

```javascript
// useNotifications.js
source.addEventListener("new_message", (event) => {
  const data = JSON.parse(event.data);
  setNotifications((prev) => [data, ...prev]);
});
```

---

# Backend Implementation

## notification.service.js — Client Registry

Purpose: track open SSE connections per user.

```javascript
// Map<userId, Set<Express.Response>>
const clients = new Map();
```

| Function | What it does |
|----------|--------------|
| `addClient(userId, res)` | Register a browser tab |
| `removeClient(userId, res)` | Unregister on disconnect |
| `writeEvent(res, event, data)` | Write one SSE event |
| `sendNotification(userId, payload)` | Push to all tabs of that user |

`sendNotification` uses the payload `type` as the event name (e.g. `new_message`).

---

## notification.controller.js — SSE Endpoint

**Route:** `GET /api/notifications/stream?token=<JWT>`

Required headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Rules:

- Do **not** call `res.json()` after starting the stream
- Keep the connection open until the client disconnects
- Clear the heartbeat interval on `req.on("close")`

---

## notification.route.js

```javascript
GET /stream → streamNotifications
```

Mounted at `/api/notifications` via `protected.route.js`.

Full path: `/api/notifications/stream`

---

## Trigger: socket.js

When User A sends a message to User B (and B has A as a contact):

1. Message saved to DB (WebSocket handler)
2. WebSocket broadcasts to open chat rooms
3. SSE pushes notification to B's Navbar

```
User A sends message
        │
        ▼
   saveMessage()
        │
        ├──► WebSocket broadcast (chat rooms)
        │
        └──► sendNotification() (SSE → Navbar)
```

---

# Frontend Implementation

## useNotifications.js

- Opens `EventSource` when the user is logged in
- Listens for:
  - `connected` → sets `connected: true`
  - `new_message` → adds to notifications array
- Cleans up on unmount: `source.close()`

Returns:

```javascript
{
  notifications,
  connected,
  unreadCount,
  clearNotifications,
}
```

---

## NotificationBell.jsx

- Shows notification count in the Navbar
- Green/grey dot = SSE connected / disconnected
- Dropdown with message preview + **Open chat** link

---

## Vite Proxy (Dev)

```javascript
// vite.config.js
"/api": "http://localhost:5000"  // SSE stream proxied through Vite
```

During development, the frontend calls `/api/notifications/stream` and Vite forwards it to the Express backend on port 5000.

---

# Event Types

| Event name | When sent | Payload |
|------------|-----------|---------|
| `connected` | SSE opens | `{ message: "SSE connected" }` |
| `new_message` | Someone sends you a message | `{ type, from, preview, contactId, messageId }` |
| `: heartbeat` | Every 30s | Comment (keeps connection alive) |

---

# Example Scenario

1. Alice and Bob are both registered
2. Both added each other as contacts
3. Bob is on the Dashboard (not on the chat page)
4. Alice opens Bob's contact and sends: **"Hi Bob!"**

What happens:

```
Alice → WebSocket send
     → DB save
     → WebSocket broadcast to Alice's chat room
     → WebSocket broadcast to Bob's chat room (if open)
     → SSE sendNotification(Bob's userId)
     → Bob's Navbar shows: "alice@test.com: Hi Bob!"
```

Bob sees the notification **without refreshing the page**.

---

# Key Concepts

- **SSE = one-way push** — good for notifications, not chat input
- **Connection stays open** — unlike normal REST which closes after one response
- **In-memory client Map** — lost on server restart (fine for learning)
- **Multiple tabs** — one user can have multiple `res` objects in a `Set`
- **JWT in query string** — required because `EventSource` has limited header support
- **Heartbeats** — prevent proxies and load balancers from closing idle connections

---

# File Structure

```
backend/src/services/notification/
  notification.service.js    ← client registry + push logic
  notification.controller.js ← SSE HTTP endpoint
  notification.route.js      ← router

backend/src/websocket/socket.js  ← triggers sendNotification()

frontend/src/hooks/useNotifications.js   ← EventSource hook
frontend/src/components/NotificationBell.jsx
frontend/src/components/Navbar.jsx         ← uses NotificationBell
```

---

# How to Test

1. Start backend + frontend

```bash
npm run dev:backend   # from day1/
npm run dev:frontend  # from day1/
```

2. Login as **User A** in Browser 1
3. Login as **User B** in Browser 2
4. Both add each other as contacts
5. **B** stays on Dashboard (watch Navbar — green dot = SSE connected)
6. **A** sends a message from B's contact page
7. **B** should see a notification in the Navbar without refreshing

---

# Summary

| Feature | REST | SSE | WebSocket |
|---------|------|-----|-----------|
| Connection | Closes after response | Stays open | Stays open |
| Direction | Request → Response | Server → Client | Two-way |
| Protocol | HTTP | HTTP | WebSocket |
| Use case | CRUD APIs | Notifications, feeds | Chat, games |
| Browser API | `fetch` | `EventSource` | `WebSocket` |

---

# Key Takeaways

- SSE lets the server push real-time updates over a single long-lived HTTP connection.
- It is **one-way** — perfect for notifications, not for sending chat messages.
- This project uses **WebSocket for chat** and **SSE for navbar alerts**.
- Events use the `text/event-stream` format with `event:` and `data:` fields.
- `EventSource` cannot easily send auth headers, so JWT is passed via `?token=`.
- The backend keeps a `Map` of connected clients and pushes events when messages arrive.
- Heartbeats keep the connection alive across proxies and idle timeouts.


Technical Product Manager Intern — Orakris, Founder’s Office
Aug 2026 – Jan 2027

Working closely with the founders on product and business initiatives.
Driving product discovery, defining requirements, and working with engineering on execution.

Technical Product Manager Intern — Margawise
6 months

Worked on product discovery, user research, AI-powered features, and product workflows.
Reduced AI generation latency by 75% and contributed to converting 5+ incubation centers into paying customers.

Backend Engineer Intern — NVipani
3 months

Frontend Engineer Intern — ITProfound
2 months

Frontend Engineer Intern — MOCX
2 months

