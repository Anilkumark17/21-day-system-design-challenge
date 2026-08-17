const { getAppStats } = require("./cron.service");

const runStatsLog = async () => {
  const stats = await getAppStats();

  console.log(
    `[cron] App stats — users: ${stats.users}, contacts: ${stats.contacts}, messages: ${stats.messages}`
  );
};

module.exports = { runStatsLog };
