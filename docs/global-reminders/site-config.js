/**
 * Публичный HTTPS-URL бота (aiohttp), только хост, без пути.
 * Не добавляй /health — проверка бота: открой в браузере отдельно .../health
 * В Discord OAuth2 → Redirects: тот же хост + /api/global-reminders/oauth/callback
 */
window.GLOBAL_REMINDERS_API_BASE = "https://bot2eod.duckdns.org";

/** Query token для GET /api/global-reminders/server-roles (если задан секрет в боте) */
window.GLOBAL_REMINDERS_API_TOKEN = "QGJEQRGNKWRHGM";

window.GLOBAL_REMINDERS_GUILD_ID = "1100793897933885515";

/** OAuth2 → Application ID (публичный) */
window.GLOBAL_REMINDERS_DISCORD_CLIENT_ID = "1485895271345819748";

/** ID канала по умолчанию для новых строк */
window.GLOBAL_REMINDERS_DEFAULT_CHANNEL_ID = "1371415634897801277";
