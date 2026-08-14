# WebSockets Notes

A beginner-friendly guide to understanding **WebSockets**, how they differ from HTTP Long Polling, the WebSocket handshake process, TCP connections, masking, fragmentation, and implementing real-time communication using Express.js and React.

---

# Table of Contents

- What are WebSockets?
- Why WebSockets?
- HTTP Long Polling
- WebSockets vs Long Polling
- TCP Connection
- WebSocket Handshake
- HTTP Upgrade Request
- WebSocket URL
- Masking
- Fragmentation
- Express + React Architecture
- Real-world Use Cases

---

# What are WebSockets?

WebSockets are a communication protocol that allows a **persistent, full-duplex (two-way)** communication channel between the client and the server.

Unlike HTTP, the connection remains open after it is established.

```
Client  <=====================>  Server
          Two-way Communication
```

Both the client and server can send data at any time without waiting for a request.

---

# Why WebSockets?

Without WebSockets, applications typically rely on polling or long polling to check for updates.

Examples requiring real-time communication:

- Chat applications
- Live notifications
- Multiplayer games
- Google Docs
- Figma
- Stock market updates
- Collaborative whiteboards
- Live dashboards

---

# HTTP Long Polling

In HTTP, communication follows the Request → Response model.

```
Client -----------------------> Server
        HTTP Request

Client <----------------------- Server
        HTTP Response
```

If the client needs new data, it must send another request.

```
Request
↓

Response

↓

Request Again

↓

Response Again
```

## Problems

- Higher latency
- More HTTP requests
- Additional TCP overhead
- Increased server load
- Not suitable for highly interactive applications

---

# WebSockets Solution

WebSockets establish a single persistent connection.

```
Client ====================== Server
       Open Connection
```

Messages can flow in both directions at any time.

```
Client
   │
   │ Message
   ▼
Server

Server
   │
   │ Notification
   ▼
Client
```

Benefits

- Low latency
- No repeated HTTP requests
- Faster communication
- Lightweight after connection establishment
- Ideal for real-time applications

---

# TCP Connection

WebSockets are built on top of **TCP (Transmission Control Protocol)**.

TCP provides:

- Reliable communication
- Ordered delivery
- No duplicate packets
- Error checking
- Retransmission of lost packets

```
Application
      │
WebSocket
      │
TCP
      │
IP
```

Because WebSockets use TCP, messages arrive in the correct order.

---

# WebSocket Handshake

A WebSocket connection begins as a normal HTTP request.

```
Client -----------------------> Server
          HTTP Request
```

The client asks the server to upgrade the connection.

```
Upgrade: websocket
```

If the server supports WebSockets:

```
HTTP/1.1 101 Switching Protocols
```

Connection established:

```
Client ====================== Server
```

The HTTP connection is now upgraded into a WebSocket connection.

---

# WebSocket Handshake Flow

```
Client                       Server

HTTP Request
Upgrade: websocket
---------------------------->

                    Validate Request

<----------------------------
101 Switching Protocols

========== WebSocket ==========
```

---

# HTTP Upgrade Headers

Example request

```http
GET /chat HTTP/1.1
Host: localhost:5000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: xxxxxxxxxxxxxx
Sec-WebSocket-Version: 13
```

Example response

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: yyyyyyyyyyyyy
```

---

# Sec-WebSocket-Key

The client generates a random Base64 key.

Example

```
Sec-WebSocket-Key:
dGhlIHNhbXBsZSBub25jZQ==
```

Purpose

- Prevents accidental upgrades
- Verifies the handshake
- Ensures the server understands the WebSocket protocol

The server returns a computed value in:

```
Sec-WebSocket-Accept
```

---

# 101 Switching Protocols

```
HTTP/1.1 101 Switching Protocols
```

Means:

> The server accepted the request and switched from HTTP to the WebSocket protocol.

---

# WebSocket URLs

Non-secure

```
ws://localhost:5000
```

Secure (TLS)

```
wss://example.com
```

Default Ports

```
ws  -> Port 80

wss -> Port 443
```

---

# Masking

Masking is applied **only by the client**.

Purpose

- Prevent proxy cache poisoning
- Prevent intermediaries from interpreting WebSocket frames as HTTP traffic
- Improve protocol safety

The browser masks outgoing frames before sending them.

The server removes the mask before processing the message.

```
Client
Message
↓

Mask

↓

Server

↓

Unmask

↓

Original Message
```

---

# Fragmentation

Large messages are divided into smaller frames.

Instead of

```
5 MB Message
```

It becomes

```
Frame 1

Frame 2

Frame 3

Frame 4
```

Benefits

- Avoids buffer overflow
- Efficient transmission
- Supports streaming
- Better memory usage

The receiver automatically reassembles the fragments.

---

# Express + React Architecture

```
React

↓

WebSocket

↓

Express Server

↓

Broadcast

↓

Connected Clients
```

---

# Broadcast Messaging

```
Client A

↓

Server

↓

Client B

↓

Client C

↓

Client D
```

The server broadcasts updates to every connected client.

---

# Observer Pattern

WebSockets commonly implement the Observer Pattern.

```
        Subject
     (WebSocket Server)

     /     |      \

Client1 Client2 Client3
```

When the subject changes, every subscribed client receives the update.

---

# Real-world Applications

- WhatsApp
- Slack
- Discord
- Microsoft Teams
- Google Docs
- Figma
- Trello
- Jira
- Live Sports Scores
- Trading Platforms
- Multiplayer Games

---

# Advantages

- Real-time communication
- Persistent connection
- Low latency
- Less network overhead
- Full-duplex communication
- Efficient resource utilization
- Ideal for collaborative applications

---

# Summary

| Feature | HTTP | WebSocket |
|----------|------|-----------|
| Connection | Request/Response | Persistent |
| Communication | One-way | Two-way |
| Latency | Higher | Very Low |
| Polling Required | Yes | No |
| Real-Time | No | Yes |
| TCP Based | Yes | Yes |
| Uses Handshake | No | Yes |

---

# Key Takeaways

- WebSockets create a persistent two-way communication channel.
- They begin with an HTTP handshake and upgrade to the WebSocket protocol.
- WebSockets rely on TCP for reliable, ordered message delivery.
- The client masks outgoing frames for security.
- Large messages are fragmented into smaller frames for efficient transfer.
- They are the preferred choice for real-time applications such as chat, collaboration tools, dashboards, and games.
