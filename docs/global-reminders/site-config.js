/**
 * Публичный HTTPS-URL бота (aiohttp), без слэша в конце.
 * В Discord OAuth2 → Redirects: тот же хост + /api/global-reminders/oauth/callback
 */
window.GLOBAL_REMINDERS_API_BASE = "";

/** Query token для GET /api/global-reminders/server-roles (если задан секрет в боте) */
window.GLOBAL_REMINDERS_API_TOKEN = "";

window.GLOBAL_REMINDERS_GUILD_ID = "1100793897933885515";

/** OAuth2 → Application ID (публичный) */
window.GLOBAL_REMINDERS_DISCORD_CLIENT_ID = "";

/** ID канала по умолчанию для новых строк */
window.GLOBAL_REMINDERS_DEFAULT_CHANNEL_ID = "1371415634897801277";
