What is SSE?
Server-Sent Events (SSE) is a one-way communication channel:

Server  ──────────────────────►  Browser
        (push events over HTTP)
Uses normal HTTP (not a WebSocket upgrade)
Server → client only (browser cannot send data back on the same stream)
Browser API: EventSource
Response type: text/event-stream
SSE vs WebSocket in this project
Feature	Technology	Purpose
Live chat on contact page
WebSocket (/ws)
Send + receive messages
Navbar notifications
SSE (/api/notifications/stream)
Alert user when a new message arrives
Architecture overview
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
End-to-end flow
1. User logs in
JWT stored in localStorage
Navbar renders NotificationBell
2. SSE connection opens
// frontend/src/hooks/useNotifications.js
const source = new EventSource(`/api/notifications/stream?token=${token}`);
3. Backend validates & registers client
// notification.controller.js
user = verifyToken(token);
addClient(userId, res);  // store Express response object
writeEvent(res, "connected", { message: "SSE connected" });
4. Connection stays open
Heartbeat every 30s: : heartbeat\n\n
On tab close: removeClient(userId, res)
5. Someone sends a message (WebSocket)
// socket.js — after message saved
sendNotification(receiverTarget.userId, {
  type: "new_message",
  from: user.email,
  preview: content,
  contactId: receiverTarget.contactId,
  messageId: message.id,
});
6. Receiver gets notification instantly
// useNotifications.js
source.addEventListener("new_message", (event) => {
  const data = JSON.parse(event.data);
  setNotifications(prev => [data, ...prev]);
});
Backend files
notification.service.js — Client registry
Purpose: Track open SSE connections per user.

// Map<userId, Set<Express.Response>>
const clients = new Map();
Function	What it does
addClient(userId, res)
Register browser tab
removeClient(userId, res)
Unregister on disconnect
writeEvent(res, event, data)
Write one SSE event
sendNotification(userId, payload)
Push to all tabs of that user
SSE message format:

event: new_message
data: {"type":"new_message","from":"alice@test.com","preview":"Hello!"}
notification.controller.js — SSE endpoint
Route: GET /api/notifications/stream?token=<JWT>

Important headers:

Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Why token in query?
EventSource cannot send Authorization: Bearer headers easily, so JWT is passed as ?token= (same pattern as WebSocket).

Rules:

Do not call res.json() after starting the stream
Keep connection open until client disconnects
notification.route.js
GET /api/notifications/stream → streamNotifications
Mounted at: /api/notifications via protected.route.js

Trigger: socket.js
When User A sends a message to User B (and B has A as a contact):

Message saved to DB (WebSocket)
WebSocket broadcasts to open chat rooms
SSE pushes notification to B's Navbar
Frontend files
useNotifications.js
Opens EventSource when user is logged in
Listens for:
connected → sets connected: true
new_message → adds to notifications array
Cleans up on unmount: source.close()
NotificationBell.jsx
Shows notification count
Green/grey dot = SSE connected/disconnected
Dropdown with message preview + Open chat link
Vite proxy (dev)
"/api": "http://localhost:5000"  // SSE stream proxied through Vite
Event types
Event name	When sent	Payload
connected
SSE opens
{ message: "SSE connected" }
new_message
Someone sends you a message
{ type, from, preview, contactId, messageId }
: heartbeat
Every 30s
(comment, keeps connection alive)
Example scenario
Alice and Bob both registered
Both added each other as contacts
Bob is on Dashboard (not on chat page)
Alice opens Bob's contact and sends: "Hi Bob!"
What happens:

Alice → WebSocket send
     → DB save
     → WebSocket broadcast to Alice's chat room
     → WebSocket broadcast to Bob's chat room (if open)
     → SSE sendNotification(Bob's userId)
     → Bob's Navbar shows: "alice@test.com: Hi Bob!"
Key concepts to remember
SSE = one-way push — good for notifications, not chat input
Connection stays open — unlike normal REST which closes after response
In-memory client Map — lost on server restart (fine for learning)
Multiple tabs — one user can have multiple res objects in a Set
JWT in query string — required because EventSource has limited header support
File structure
backend/src/services/notification/
  notification.service.js    ← client registry + push logic
  notification.controller.js ← SSE HTTP endpoint
  notification.route.js        ← router
backend/src/websocket/socket.js  ← triggers sendNotification()
frontend/src/hooks/useNotifications.js   ← EventSource hook
frontend/src/components/NotificationBell.jsx
frontend/src/components/Navbar.jsx       ← uses NotificationBell
How to test
Start backend + frontend
Login as User A in Browser 1
Login as User B in Browser 2
Both add each other as contacts
B stays on Dashboard (watch Navbar — green dot = SSE connected)
A sends message from B's contact page
B should see notification in Navbar without refreshing