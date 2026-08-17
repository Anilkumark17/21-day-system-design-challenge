const { sendNotification } = require("../services/notification/notification.service");
const { getAllUsers, getRecentMessageCountForUser } = require("./cron.service");

const runDailyDigest = async () => {
  console.log("[cron] Running daily message digest...");

  const users = await getAllUsers();
  let notified = 0;

  for (const user of users) {
    const recentCount = await getRecentMessageCountForUser(user.email, 24);

    if (recentCount === 0) {
      continue;
    }

    sendNotification(user.id, {
      type: "daily_digest",
      message: `You received ${recentCount} message(s) in the last 24 hours`,
      count: recentCount,
    });

    notified += 1;
  }

  console.log(`[cron] Daily digest complete. Notified ${notified} user(s).`);
};

module.exports = { runDailyDigest };
