const cron = require("node-cron");
const { runDailyDigest } = require("./dailyDigest.job");
const { runMessageCleanup } = require("./cleanupMessages.job");
const { runStatsLog } = require("./stats.job");

const safeRun = (jobName, jobFn) => async () => {
  try {
    await jobFn();
  } catch (error) {
    console.error(`[cron] ${jobName} failed:`, error);
  }
};

const startCronJobs = () => {
  if (process.env.ENABLE_CRON !== "true") {
    console.log("[cron] Cron jobs disabled. Set ENABLE_CRON=true to enable.");
    return;
  }

  const digestSchedule = process.env.CRON_DAILY_DIGEST || "0 9 * * *";
  const cleanupSchedule = process.env.CRON_MESSAGE_CLEANUP || "0 3 * * 0";
  const statsSchedule = process.env.CRON_STATS || "0 * * * *";

  cron.schedule(digestSchedule, safeRun("dailyDigest", runDailyDigest));
  cron.schedule(cleanupSchedule, safeRun("messageCleanup", runMessageCleanup));
  cron.schedule(statsSchedule, safeRun("statsLog", runStatsLog));

  console.log("[cron] Cron jobs started:");
  console.log(`  - Daily digest:      ${digestSchedule}`);
  console.log(`  - Message cleanup:   ${cleanupSchedule}`);
  console.log(`  - Hourly stats log:  ${statsSchedule}`);
};

module.exports = { startCronJobs, runDailyDigest, runMessageCleanup, runStatsLog };
