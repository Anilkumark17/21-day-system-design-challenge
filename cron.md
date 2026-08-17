# Cron Jobs Notes

A beginner-friendly guide to understanding **cron jobs**, how scheduling works internally, cron expression syntax, and how this project uses `node-cron` for daily digests, message cleanup, and hourly stats logging.

---

# Table of Contents

- What are Cron Jobs?
- Why Cron Jobs?
- How Cron Jobs Work
- Internal Working
- Cron Expression Syntax
- node-cron Library
- Architecture in This Project
- Enabling Cron Jobs
- Job 1: Hourly Stats Log
- Job 2: Daily Message Digest
- Job 3: Message Cleanup
- Shared Service Layer
- Integration with SSE
- Environment Variables
- Manual Execution
- File Structure
- How to Test
- Summary
- Key Takeaways

---

# What are Cron Jobs?

A **cron job** is a task that runs automatically on a **schedule** — without a user clicking anything or calling an API.

```
Time passes
    │
    ▼
Schedule matches (e.g. every day at 9 AM)
    │
    ▼
Task runs automatically
```

Examples in real applications:

- Send daily email digests
- Delete expired sessions or old data
- Generate reports at midnight
- Sync data with external services
- Log health or usage statistics

Cron jobs are **background, time-based automation** for server-side work.

---

# Why Cron Jobs?

Some work should not happen on every HTTP request or WebSocket message.

| Without cron | With cron |
|--------------|-----------|
| User must trigger cleanup manually | Old messages deleted automatically |
| Stats only checked when someone asks | Stats logged every hour |
| No daily summary unless built custom | Digest sent on a fixed schedule |

In this project, cron jobs handle:

- **Monitoring** — log user/contact/message counts
- **Notifications** — daily summary of messages received
- **Maintenance** — delete messages older than 90 days

These tasks run in the **same Node.js process** as the Express server, scheduled by `node-cron`.

---

# How Cron Jobs Work

At a high level:

```
┌─────────────────────────────────────────┐
│           Node.js Server                 │
│                                          │
│  Express API  +  WebSocket  +  SSE       │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │         Cron Scheduler           │    │
│  │   (checks schedule every minute) │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│     ┌───────────┼───────────┐            │
│     ▼           ▼           ▼            │
│  statsLog   dailyDigest  cleanup         │
└─────────────────────────────────────────┘
```

1. Server starts
2. Scheduler registers jobs with cron expressions (e.g. `0 9 * * *`)
3. Every minute, the scheduler checks: "Is it time to run any job?"
4. When a schedule matches, the job function executes
5. Job reads/writes the database, sends notifications, or logs output

The user does **not** need to be online. The server runs the task when the clock hits the scheduled time.

---

# Internal Working

## 1. Cron expression → next run time

Each job has a **cron expression** — five fields that describe when to run:

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0–7, Sunday = 0 or 7)
│ │ │ └──── Month (1–12)
│ │ └────── Day of month (1–31)
│ └──────── Hour (0–23)
└────────── Minute (0–59)
```

Example: `0 9 * * *` means:

- Minute = 0
- Hour = 9
- Every day, every month, every day of week

→ **Run at 9:00 AM every day**

## 2. Scheduler loop (node-cron)

`node-cron` does not use the OS `cron` daemon directly. Inside your Node process it:

1. Parses the cron expression
2. Computes the **next execution time**
3. Sets a timer (typically checked every minute)
4. When current time ≥ next run time → calls your callback
5. Recomputes the next run time and repeats

```
Register: cron.schedule("0 * * * *", callback)
                │
                ▼
        Parse expression
                │
                ▼
        Wait until next :00 minute
                │
                ▼
        Execute callback
                │
                ▼
        Schedule next run
                │
                └── (repeat forever while server runs)
```

## 3. Job callback execution

In this project, every job is wrapped in `safeRun`:

```javascript
const safeRun = (jobName, jobFn) => async () => {
  try {
    await jobFn();
  } catch (error) {
    console.error(`[cron] ${jobName} failed:`, error);
  }
};
```

This means:

- Jobs can be `async` (database queries, etc.)
- One failed job does **not** crash the server
- Errors are logged with the job name

## 4. In-process vs system cron

| Approach | How it works |
|----------|--------------|
| **System cron** (Linux `crontab`) | OS runs a script at scheduled times |
| **node-cron** (this project) | Scheduler runs inside the Node.js server |

**Trade-off:** If the server is down at 9 AM, the daily digest **will not run** until the next scheduled time. For production, some teams use external schedulers (AWS EventBridge, GitHub Actions, etc.) or a dedicated worker process.

---

# Cron Expression Syntax

Common patterns used in this project:

| Expression | Meaning |
|------------|---------|
| `0 * * * *` | Every hour at minute 0 |
| `0 9 * * *` | Every day at 9:00 AM |
| `0 3 * * 0` | Every Sunday at 3:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of every month at midnight |

Special characters:

- `*` — any value
- `*/n` — every n units
- `1,3,5` — specific values
- `1-5` — range

---

# node-cron Library

This project uses [`node-cron`](https://www.npmjs.com/package/node-cron):

```javascript
const cron = require("node-cron");

cron.schedule("0 9 * * *", () => {
  console.log("Runs every day at 9 AM");
});
```

API used here:

```javascript
cron.schedule(scheduleExpression, callbackFunction);
```

- `scheduleExpression` — string like `"0 9 * * *"`
- `callbackFunction` — function to run (can be async)

Jobs are registered once when the server starts via `startCronJobs()`.

---

# Architecture in This Project

```
backend/index.js
       │
       ▼
startCronJobs()          ← called after server.listen()
       │
       ▼
backend/src/cron/index.js
       │
       ├── stats.job.js        → runStatsLog()
       ├── dailyDigest.job.js  → runDailyDigest()
       └── cleanupMessages.job.js → runMessageCleanup()
                │
                ▼
       cron.service.js         ← shared DB queries
                │
                ├── getAppStats()
                ├── getAllUsers()
                ├── getRecentMessageCountForUser()
                └── deleteOldMessages()
```

Cron jobs sit **alongside** Express, WebSocket, and SSE — they share the same database and notification service.

---

# Enabling Cron Jobs

Cron jobs are **disabled by default**.

```javascript
// backend/src/cron/index.js
if (process.env.ENABLE_CRON !== "true") {
  console.log("[cron] Cron jobs disabled. Set ENABLE_CRON=true to enable.");
  return;
}
```

Add to your backend `.env`:

```env
ENABLE_CRON=true
```

When enabled, schedules are loaded from environment variables (with defaults):

```javascript
const digestSchedule = process.env.CRON_DAILY_DIGEST || "0 9 * * *";
const cleanupSchedule = process.env.CRON_MESSAGE_CLEANUP || "0 3 * * 0";
const statsSchedule = process.env.CRON_STATS || "0 * * * *";

cron.schedule(digestSchedule, safeRun("dailyDigest", runDailyDigest));
cron.schedule(cleanupSchedule, safeRun("messageCleanup", runMessageCleanup));
cron.schedule(statsSchedule, safeRun("statsLog", runStatsLog));
```

Server startup log:

```
[cron] Cron jobs started:
  - Daily digest:      0 9 * * *
  - Message cleanup:   0 3 * * 0
  - Hourly stats log:  0 * * * *
```

---

# Job 1: Hourly Stats Log

**File:** `backend/src/cron/stats.job.js`  
**Default schedule:** `0 * * * *` (every hour)  
**Purpose:** Monitoring — log total counts to the server console

## Code

```javascript
const { getAppStats } = require("./cron.service");

const runStatsLog = async () => {
  const stats = await getAppStats();

  console.log(
    `[cron] App stats — users: ${stats.users}, contacts: ${stats.contacts}, messages: ${stats.messages}`
  );
};

module.exports = { runStatsLog };
```

## What happens internally

```
Cron fires at :00 each hour
        │
        ▼
getAppStats()
        │
        ├── COUNT users
        ├── COUNT contacts
        └── COUNT messages   (parallel via Promise.all)
        │
        ▼
console.log stats
```

**Does not** modify the database or notify users. Read-only logging for observability.

---

# Job 2: Daily Message Digest

**File:** `backend/src/cron/dailyDigest.job.js`  
**Default schedule:** `0 9 * * *` (9:00 AM daily)  
**Purpose:** Notify each user how many messages they received in the last 24 hours

## Code

```javascript
const runDailyDigest = async () => {
  const users = await getAllUsers();
  let notified = 0;

  for (const user of users) {
    const recentCount = await getRecentMessageCountForUser(user.email, 24);

    if (recentCount === 0) continue;

    sendNotification(user.id, {
      type: "daily_digest",
      message: `You received ${recentCount} message(s) in the last 24 hours`,
      count: recentCount,
    });

    notified += 1;
  }

  console.log(`[cron] Daily digest complete. Notified ${notified} user(s).`);
};
```

## What happens internally

```
9:00 AM — cron triggers
        │
        ▼
Fetch all users from DB
        │
        ▼
For each user:
        │
        ├── Count messages where receiverEmail = user.email
        │   AND createdAt >= (now - 24 hours)
        │
        ├── If count = 0 → skip
        │
        └── If count > 0 → sendNotification() via SSE
                │
                ▼
        User's open browser tabs receive daily_digest event
                │
                ▼
        NotificationBell shows summary in Navbar
```

## Frontend handling

```javascript
// useNotifications.js
source.addEventListener("daily_digest", (event) => {
  const data = JSON.parse(event.data);
  setNotifications((prev) => [data, ...prev]);
});
```

```javascript
// NotificationBell.jsx
if (item.type === "daily_digest") {
  return item.message;  // e.g. "You received 3 message(s) in the last 24 hours"
}
```

**Note:** Users only see the digest if they are **logged in and SSE-connected** when the job runs. Offline users miss the live push (a production app might also store digests in DB or send email).

---

# Job 3: Message Cleanup

**File:** `backend/src/cron/cleanupMessages.job.js`  
**Default schedule:** `0 3 * * 0` (3:00 AM every Sunday)  
**Purpose:** Database maintenance — delete old messages

## Code

```javascript
const runMessageCleanup = async () => {
  const retentionDays = Number(process.env.MESSAGE_RETENTION_DAYS || 90);

  const deletedCount = await deleteOldMessages(retentionDays);

  console.log(`[cron] Message cleanup complete. Deleted ${deletedCount} message(s).`);
};
```

## What happens internally

```
Sunday 3:00 AM — cron triggers
        │
        ▼
retentionDays = 90 (or MESSAGE_RETENTION_DAYS env)
        │
        ▼
cutoff = now - 90 days
        │
        ▼
DELETE FROM messages WHERE createdAt < cutoff
        │
        ▼
Log number of deleted rows
```

This prevents the messages table from growing forever. **Destructive** — old messages are permanently removed.

---

# Shared Service Layer

**File:** `backend/src/cron/cron.service.js`

All DB logic lives here so job files stay thin.

| Function | What it does |
|----------|--------------|
| `getAppStats()` | Count users, contacts, messages (parallel queries) |
| `getAllUsers()` | Select all rows from users table |
| `getRecentMessageCountForUser(email, hours)` | Count messages received in last N hours |
| `deleteOldMessages(retentionDays)` | Delete messages older than cutoff, return count |

Example — recent message count:

```javascript
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const [result] = await db
  .select({ value: count() })
  .from(messagesTable)
  .where(
    and(
      eq(messagesTable.receiverEmail, userEmail),
      gte(messagesTable.createdAt, since)
    )
  );
```

Uses **Drizzle ORM** with the same database connection as the rest of the app.

---

# Integration with SSE

Only the **daily digest** job pushes to clients. It reuses the SSE notification system:

```
dailyDigest.job.js
        │
        ▼
sendNotification(userId, payload)
        │
        ▼
notification.service.js
        │
        ▼
writeEvent(res, "daily_digest", payload)  →  all open SSE tabs for that user
```

Same pipeline as instant `new_message` notifications from WebSocket chat — cron is just another **trigger** for `sendNotification()`.

```
WebSocket message  ──► sendNotification()  ──► SSE  ──► Navbar
Cron daily digest  ──► sendNotification()  ──► SSE  ──► Navbar
```

---

# Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_CRON` | (unset = off) | Set to `true` to start scheduled jobs |
| `CRON_STATS` | `0 * * * *` | Hourly stats log schedule |
| `CRON_DAILY_DIGEST` | `0 9 * * *` | Daily digest schedule |
| `CRON_MESSAGE_CLEANUP` | `0 3 * * 0` | Message cleanup schedule |
| `MESSAGE_RETENTION_DAYS` | `90` | Delete messages older than this many days |

Example `.env` for development (faster testing):

```env
ENABLE_CRON=true
CRON_STATS=*/5 * * * *          # every 5 minutes
CRON_DAILY_DIGEST=*/10 * * * *  # every 10 minutes
CRON_MESSAGE_CLEANUP=0 4 * * *   # daily at 4 AM
MESSAGE_RETENTION_DAYS=30
```

---

# Manual Execution

You do not need to wait for the schedule. Run any job immediately from the backend folder:

```bash
npm run cron:stats      # log stats now
npm run cron:digest     # run daily digest now
npm run cron:cleanup    # run message cleanup now
```

These scripts load `.env` and call the job function directly — useful for testing without changing cron expressions.

---

# File Structure

```
backend/
  index.js                          ← startCronJobs() on server listen

  src/cron/
    index.js                          ← scheduler setup + safeRun wrapper
    cron.service.js                   ← shared database queries
    stats.job.js                      ← hourly stats log
    dailyDigest.job.js                ← daily SSE digest
    cleanupMessages.job.js            ← delete old messages

  src/services/notification/
    notification.service.js           ← sendNotification() used by digest job

frontend/
  src/hooks/useNotifications.js       ← listens for daily_digest SSE event
  src/components/NotificationBell.jsx ← displays digest in Navbar
```

---

# How to Test

## 1. Enable cron

```env
ENABLE_CRON=true
```

For faster feedback, use shorter schedules (see Environment Variables above).

## 2. Test stats log

```bash
cd day1/backend
npm run cron:stats
```

Expected output:

```
[cron] App stats — users: 2, contacts: 4, messages: 12
```

## 3. Test daily digest

1. Start backend + frontend
2. Login as a user who received messages in the last 24 hours
3. Run: `npm run cron:digest`
4. Check Navbar — should show digest notification via SSE

## 4. Test message cleanup

1. Set `MESSAGE_RETENTION_DAYS=0` temporarily (or use old test data)
2. Run: `npm run cron:cleanup`
3. Verify old messages are removed from the database

---

# Summary

| Job | Schedule (default) | Action | Side effects |
|-----|-------------------|--------|--------------|
| Stats log | Every hour | Count DB rows | Console log only |
| Daily digest | 9 AM daily | Count recent messages per user | SSE push to connected users |
| Message cleanup | 3 AM Sunday | Delete old messages | Permanent DB deletion |

| Concept | This project |
|---------|--------------|
| Scheduler | `node-cron` (in-process) |
| Trigger | Server startup + `ENABLE_CRON=true` |
| Error handling | `safeRun` wrapper — log, don't crash |
| DB access | Drizzle ORM via `cron.service.js` |
| User notification | SSE via `sendNotification()` |

---

# Key Takeaways

- **Cron jobs** run tasks on a schedule without user interaction.
- A **cron expression** defines when a job runs (minute, hour, day, month, weekday).
- **`node-cron`** runs inside the Node.js process and checks schedules periodically.
- Jobs start when the server boots, but only if `ENABLE_CRON=true`.
- This project has three jobs: **stats logging**, **daily digest (SSE)**, and **message cleanup**.
- Shared DB logic lives in `cron.service.js`; each job file defines what to do at run time.
- The daily digest reuses the **SSE notification pipeline** — same as real-time chat alerts.
- Use **npm run cron:*** scripts to test jobs immediately without waiting for the schedule.
- In-process cron is simple for learning; production often uses external schedulers or worker processes for reliability.
