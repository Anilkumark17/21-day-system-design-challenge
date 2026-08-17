const { deleteOldMessages } = require("./cron.service");

const runMessageCleanup = async () => {
  const retentionDays = Number(process.env.MESSAGE_RETENTION_DAYS || 90);

  console.log(
    `[cron] Cleaning messages older than ${retentionDays} days...`
  );

  const deletedCount = await deleteOldMessages(retentionDays);

  console.log(`[cron] Message cleanup complete. Deleted ${deletedCount} message(s).`);
};

module.exports = { runMessageCleanup };
