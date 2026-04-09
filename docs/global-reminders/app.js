/**
 * Редактор глобалов: OAuth Discord → JWT → загрузка/сохранение в боте.
 */

const WD_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ROLE_LIST_FILE = "roles.json";
const EXPORT_FILENAME = "расписание-глобалов.json";
const DEFAULT_GUILD_ID = "1100793897933885515";
const SESS_KEY = "gr_jwt";

function apiBase() {
  if (typeof window === "undefined") return "";
  return String(window.GLOBAL_REMINDERS_API_BASE || "")
    .trim()
    .replace(/\/$/, "");
}

function apiToken() {
  if (typeof window === "undefined") return "";
  return String(window.GLOBAL_REMINDERS_API_TOKEN || "").trim();
}

function guildIdForApi() {
  if (typeof window !== "undefined" && window.GLOBAL_REMINDERS_GUILD_ID) {
    const g = String(window.GLOBAL_REMINDERS_GUILD_ID).trim();
    if (g) return g;
  }
  return DEFAULT_GUILD_ID;
}

function discordClientId() {
  return String(window.GLOBAL_REMINDERS_DISCORD_CLIENT_ID || "").trim();
}

function defaultChannelId() {
  const v = window.GLOBAL_REMINDERS_DEFAULT_CHANNEL_ID;
  if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  return "1371415634897801277";
}

function getJwt() {
  try {
    return sessionStorage.getItem(SESS_KEY) || "";
  } catch (e) {
    return "";
  }
}

function setJwt(t) {
  try {
    if (t) sessionStorage.setItem(SESS_KEY, t);
    else sessionStorage.removeItem(SESS_KEY);
  } catch (e) {
    /* ignore */
  }
}

function jwtPayloadUnverified(token) {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    const pad = "=".repeat((4 - (p.length % 4)) % 4);
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/") + pad);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function authHeaders() {
  const j = getJwt();
  if (!j) return {};
  return { Authorization: `Bearer ${j}` };
}

let allRoles = [];
let selectedRoleIds = new Set();
let reminders = [];

function $(sel) {
  return document.querySelector(sel);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function roleColorHex(c) {
  const n = Number(c) || 0;
  return `#${n.toString(16).padStart(6, "0")}`;
}

function applyRolesPayload(data) {
  const roles = data.roles;
  if (!Array.isArray(roles)) throw new Error("В ответе нет списка ролей");
  allRoles = roles.sort((a, b) => (b.position || 0) - (a.position || 0));
}

async function loadRoles() {
  const status = $("#roles-status");
  status.textContent = "Загрузка ролей…";

  let data = null;
  let hint = "";

  const base = apiBase();
  if (base) {
    try {
      let u = `${base}/api/global-reminders/server-roles?guild_id=${encodeURIComponent(guildIdForApi())}`;
      const tok = apiToken();
      if (tok) u += `&token=${encodeURIComponent(tok)}`;
      const res = await fetch(u, { cache: "no-store", mode: "cors" });
      if (res.ok) {
        data = await res.json();
        applyRolesPayload(data);
        status.textContent = `${allRoles.length} ролей`;
        renderRoleList();
        return;
      }
      hint = `Бот: HTTP ${res.status}. `;
    } catch (e) {
      hint = `${String(e.message || e)}. `;
    }
  }

  try {
    const res = await fetch(`./${ROLE_LIST_FILE}`, { cache: "no-store" });
    if (!res.ok) throw new Error(hint + `roles.json: ${res.status}`);
    data = await res.json();
    applyRolesPayload(data);
    status.textContent = `${allRoles.length} ролей (файл)`;
    renderRoleList();
  } catch (e) {
    allRoles = [];
    status.textContent = hint + String(e.message || e);
    renderRoleList();
  }
}

async function loadScheduleFromBot() {
  const base = apiBase();
  const j = getJwt();
  if (!base || !j) return;
  const res = await fetch(`${base}/api/global-reminders/schedule`, {
    headers: { ...authHeaders() },
    cache: "no-store",
    mode: "cors",
  });
  if (!res.ok) {
    $("#save-status").textContent = `Не удалось загрузить расписание: HTTP ${res.status}`;
    $("#save-status").className = "status-line err";
    return;
  }
  const data = await res.json();
  if (data.timezone) $("#default-tz").value = data.timezone;
  if (Array.isArray(data.reminders) && data.reminders.length) {
    reminders = data.reminders.map((x) => ({
      label: x.label || "",
      weekdays: Array.isArray(x.weekdays) ? x.weekdays : [0, 1, 2, 3, 4, 5, 6],
      event_hour: x.event_hour ?? 18,
      event_minute: x.event_minute ?? 0,
      remind_before_minutes: x.remind_before_minutes ?? 60,
      channel_id: String(x.channel_id ?? defaultChannelId()),
      timezone: x.timezone || data.timezone || "Europe/Moscow",
      role_ids_text: Array.isArray(x.role_ids) ? x.role_ids.join(",") : "",
    }));
    const allRids = new Set();
    data.reminders.forEach((x) => {
      (x.role_ids || []).forEach((rid) => allRids.add(String(rid)));
    });
    selectedRoleIds = allRids;
  }
}

function getSearchQuery() {
  return ($("#role-search")?.value || "").trim().toLowerCase();
}

function renderRoleList() {
  const q = getSearchQuery();
  const box = $("#role-list");
  if (!box) return;

  const filtered = allRoles.filter((r) => {
    const name = (r.name || "").toLowerCase();
    const id = String(r.id || "");
    if (!q) return true;
    return name.includes(q) || id.includes(q);
  });

  if (!filtered.length) {
    box.innerHTML = '<div class="role-item dim">Нет ролей или совпадений</div>';
    return;
  }

  box.innerHTML = filtered
    .map((r) => {
      const id = String(r.id);
      const checked = selectedRoleIds.has(id) ? "checked" : "";
      const col = roleColorHex(r.color);
      return `<label class="role-item">
        <input type="checkbox" class="chk-site" data-rid="${escapeHtml(id)}" ${checked} />
        <span class="role-swatch" style="background:${col}"></span>
        <span class="role-name">${escapeHtml(r.name || "—")}</span>
        <span class="role-id">${escapeHtml(id)}</span>
      </label>`;
    })
    .join("");

  box.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.addEventListener("change", () => {
      const rid = el.getAttribute("data-rid");
      if (el.checked) selectedRoleIds.add(rid);
      else selectedRoleIds.delete(rid);
      renderChips();
    });
  });
}

function renderChips() {
  const host = $("#selected-chips");
  if (!host) return;
  const ids = [...selectedRoleIds];
  if (!ids.length) {
    host.innerHTML = '<span class="dim">Общий список ролей не выбран</span>';
    return;
  }
  host.innerHTML = ids
    .map((id) => {
      const r = allRoles.find((x) => String(x.id) === id);
      const name = r ? r.name : id;
      return `<span class="chip">${escapeHtml(name)} <button type="button" data-rid="${escapeHtml(id)}" aria-label="×">×</button></span>`;
    })
    .join("");

  host.querySelectorAll("button[data-rid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedRoleIds.delete(btn.getAttribute("data-rid"));
      renderRoleList();
      renderChips();
    });
  });
}

function emptyReminder() {
  return {
    label: "",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    event_hour: 18,
    event_minute: 0,
    remind_before_minutes: 60,
    channel_id: defaultChannelId(),
    timezone: $("#default-tz")?.value?.trim() || "Europe/Moscow",
    role_ids_text: "",
  };
}

function renderReminders() {
  const host = $("#reminders-host");
  if (!host) return;

  if (!reminders.length) {
    reminders.push(emptyReminder());
  }

  host.innerHTML = reminders
    .map((r, idx) => {
      const wdChecks = WD_LABELS.map((lab, i) => {
        const on = r.weekdays.includes(i);
        return `<label class="weekday-lbl"><input type="checkbox" class="chk-site" data-wd="${i}" ${on ? "checked" : ""} />${lab}</label>`;
      }).join("");

      const rolesVal = escapeHtml(r.role_ids_text || "");

      return `<div class="reminder-card" data-idx="${idx}">
        <div class="grid-compact">
          <label>Подпись <input type="text" class="in-label" value="${escapeHtml(r.label)}" placeholder="Вечерний глобал" /></label>
          <label>Канал (ID) <input type="text" class="in-channel" value="${escapeHtml(String(r.channel_id))}" /></label>
          <label>Время ивента <input type="time" class="in-time" value="${String(r.event_hour).padStart(2, "0")}:${String(r.event_minute).padStart(2, "0")}" /></label>
          <label>За мин. до <input type="number" class="in-before" min="1" max="1440" value="${r.remind_before_minutes}" /></label>
          <label>Часовой пояс <input type="text" class="in-tz" value="${escapeHtml(r.timezone || "Europe/Moscow")}" /></label>
          <label class="span2">ID ролей (пусто = список выше) <input type="text" class="in-roles" value="${rolesVal}" placeholder="123,456" /></label>
        </div>
        <div class="wd-row">
          <span class="wd-label">Дни</span>
          <div class="weekdays in-weekdays">${wdChecks}</div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn accent btn-send-today">Отправить только сегодня</button>
          <button type="button" class="btn danger btn-rm" ${reminders.length < 2 ? "disabled" : ""}>Удалить строку</button>
        </div>
      </div>`;
    })
    .join("");

  host.querySelectorAll(".reminder-card").forEach((card) => {
    const idx = Number(card.getAttribute("data-idx"));
    const r = reminders[idx];
    if (!r) return;

    const t = card.querySelector(".in-time");
    if (t) {
      t.addEventListener("change", () => {
        const [h, m] = (t.value || "18:00").split(":").map((x) => parseInt(x, 10));
        r.event_hour = Math.min(23, Math.max(0, h || 0));
        r.event_minute = Math.min(59, Math.max(0, m || 0));
      });
    }
    card.querySelector(".in-label")?.addEventListener("input", (e) => {
      r.label = e.target.value;
    });
    card.querySelector(".in-channel")?.addEventListener("input", (e) => {
      r.channel_id = e.target.value.trim();
    });
    card.querySelector(".in-before")?.addEventListener("input", (e) => {
      r.remind_before_minutes = Math.max(1, parseInt(e.target.value, 10) || 60);
    });
    card.querySelector(".in-tz")?.addEventListener("input", (e) => {
      r.timezone = e.target.value.trim() || "Europe/Moscow";
    });
    card.querySelector(".in-roles")?.addEventListener("input", (e) => {
      r.role_ids_text = e.target.value;
    });
    card.querySelectorAll(".in-weekdays input").forEach((cb) => {
      cb.addEventListener("change", () => {
        const set = new Set(r.weekdays);
        const i = Number(cb.getAttribute("data-wd"));
        if (cb.checked) set.add(i);
        else set.delete(i);
        r.weekdays = [...set].sort((a, b) => a - b);
        if (!r.weekdays.length) r.weekdays = [0];
      });
    });
    card.querySelector(".btn-rm")?.addEventListener("click", () => {
      if (reminders.length < 2) return;
      reminders.splice(idx, 1);
      renderReminders();
    });
    card.querySelector(".btn-send-today")?.addEventListener("click", () => sendTodayForRow(idx, card));
  });
}

function collectRowPayload(card, idx) {
  const r = reminders[idx];
  if (!r) return null;
  const ch = (card.querySelector(".in-channel")?.value || "").trim();
  const before = Math.max(1, parseInt(card.querySelector(".in-before")?.value, 10) || 60);
  const timeVal = card.querySelector(".in-time")?.value || "18:00";
  const [h, m] = timeVal.split(":").map((x) => parseInt(x, 10));

  const rowRolesRaw = (card.querySelector(".in-roles")?.value || "").trim();
  let roleIds = [];
  if (rowRolesRaw) {
    roleIds = rowRolesRaw
      .split(/[,;\s]+/)
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  } else {
    roleIds = [...selectedRoleIds].map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
  }
  if (!ch || !roleIds.length) return null;

  const emins = (h || 0) * 60 + (m || 0);
  if (emins < before) {
    throw new Error(
      `Строка ${idx + 1}: время ивента раньше, чем за ${before} мин до него.`
    );
  }

  return {
    label: (card.querySelector(".in-label")?.value || "").trim() || "Глобал",
    weekdays: [...r.weekdays].sort((a, b) => a - b),
    event_hour: h || 0,
    event_minute: m || 0,
    remind_before_minutes: before,
    channel_id: parseInt(ch, 10),
    role_ids: roleIds,
    timezone: (card.querySelector(".in-tz")?.value || "").trim() || $("#default-tz")?.value?.trim() || "Europe/Moscow",
  };
}

function collectExport() {
  const tz = $("#default-tz")?.value?.trim() || "Europe/Moscow";
  const out = {
    schema: 1,
    timezone: tz,
    reminders: [],
  };

  document.querySelectorAll(".reminder-card").forEach((card, idx) => {
    try {
      const one = collectRowPayload(card, idx);
      if (one) out.reminders.push(one);
    } catch (e) {
      throw e;
    }
  });

  if (!out.reminders.length) {
    throw new Error("Нужны канал и роли в хотя бы одной строке.");
  }
  return out;
}

async function sendTodayForRow(idx, card) {
  const st = $("#save-status");
  try {
    const rem = collectRowPayload(card, idx);
    if (!rem) {
      st.textContent = "Укажи канал и роли для этой строки.";
      st.className = "status-line err";
      return;
    }
    const base = apiBase();
    const res = await fetch(`${base}/api/global-reminders/send-today`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        reminder: rem,
        timezone: $("#default-tz")?.value?.trim() || "Europe/Moscow",
      }),
      mode: "cors",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      st.textContent = j.error || `Ошибка ${res.status}`;
      st.className = "status-line err";
      return;
    }
    st.textContent = "Сообщение отправлено в канал (разово).";
    st.className = "status-line ok";
  } catch (e) {
    st.textContent = String(e.message || e);
    st.className = "status-line err";
  }
}

function buildRemindersForSave() {
  const tz = $("#default-tz")?.value?.trim() || "Europe/Moscow";
  const remindersOut = [];
  document.querySelectorAll(".reminder-card").forEach((card, idx) => {
    const one = collectRowPayload(card, idx);
    if (one) remindersOut.push(one);
  });
  return { schema: 1, timezone: tz, reminders: remindersOut };
}

async function saveToBot() {
  const st = $("#save-status");
  try {
    const data = buildRemindersForSave();
    const base = apiBase();
    const res = await fetch(`${base}/api/global-reminders/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(data),
      mode: "cors",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      st.textContent = j.error || `HTTP ${res.status}`;
      st.className = "status-line err";
      return;
    }
    const w = (j.warnings || []).length ? ` Предупреждения: ${j.warnings.join("; ")}` : "";
    st.textContent = `Сохранено записей: ${j.saved ?? "?"}.${w}`;
    st.className = "status-line ok";
  } catch (e) {
    st.textContent = String(e.message || e);
    st.className = "status-line err";
  }
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function updateAuthUi() {
  const j = getJwt();
  const pl = j ? jwtPayloadUnverified(j) : null;
  const userEl = $("#auth-user");
  const loginBtn = $("#btn-discord-login");
  const outBtn = $("#btn-logout");
  if (j && pl && pl.sub) {
    const name = pl.username || pl.sub;
    userEl.textContent = `@${name}`;
    userEl.classList.remove("muted");
    loginBtn.classList.add("hidden");
    outBtn.classList.remove("hidden");
  } else {
    userEl.textContent = "";
    userEl.classList.add("muted");
    loginBtn.classList.remove("hidden");
    outBtn.classList.add("hidden");
  }
}

function showGate(msg) {
  const gm = $("#gate-msg");
  if (gm && msg) gm.textContent = msg;
  $("#gate")?.classList.remove("hidden");
}

function hideGate() {
  $("#gate")?.classList.add("hidden");
}

async function bootAfterHash() {
  const h = location.hash;
  if (h.startsWith("#gr_session=")) {
    const t = decodeURIComponent(h.slice("#gr_session=".length));
    if (t) setJwt(t);
    history.replaceState(null, "", location.pathname + location.search);
  }
}

async function startDiscordLogin() {
  const base = apiBase();
  const cid = discordClientId();
  if (!base || !cid) {
    showGate("Заполни GLOBAL_REMINDERS_API_BASE и GLOBAL_REMINDERS_DISCORD_CLIENT_ID в site-config.js");
    return;
  }
  try {
    const stRes = await fetch(`${base}/api/global-reminders/oauth/state`, { mode: "cors" });
    if (!stRes.ok) {
      showGate(`Сервер OAuth: HTTP ${stRes.status}. Проверь GLOBAL_REMINDERS_SITE_API_ENABLE и секреты на боте.`);
      return;
    }
    const { state } = await stRes.json();
    const redirect = encodeURIComponent(`${base}/api/global-reminders/oauth/callback`);
    const scope = encodeURIComponent("identify");
    const url =
      `https://discord.com/api/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(cid)}` +
      `&scope=${scope}&state=${encodeURIComponent(state)}&redirect_uri=${redirect}`;
    window.location.href = url;
  } catch (e) {
    showGate(String(e.message || e));
  }
}

async function openMain() {
  hideGate();
  $("#app-main")?.classList.remove("hidden");
  updateAuthUi();
  await loadRoles();
  await loadScheduleFromBot();
  renderReminders();
  renderChips();
  renderRoleList();
}

function init() {
  const base = apiBase();
  $("#redirect-hint").textContent = base
    ? `${base}/api/global-reminders/oauth/callback`
    : "(сначала укажи GLOBAL_REMINDERS_API_BASE)";

  $("#role-search")?.addEventListener("input", () => renderRoleList());

  $("#btn-discord-login")?.addEventListener("click", startDiscordLogin);
  $("#btn-logout")?.addEventListener("click", () => {
    setJwt("");
    location.reload();
  });

  $("#btn-add-row")?.addEventListener("click", () => {
    reminders.push(emptyReminder());
    renderReminders();
  });

  $("#btn-save-bot")?.addEventListener("click", saveToBot);

  $("#btn-export-file")?.addEventListener("click", () => {
    const st = $("#export-status");
    try {
      const data = collectExport();
      downloadJson(EXPORT_FILENAME, data);
      st.textContent = "Файл скачан.";
      st.className = "status-line ok";
    } catch (e) {
      st.textContent = String(e.message || e);
      st.className = "status-line err";
    }
  });

  $("#btn-import-file")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.reminders || !Array.isArray(data.reminders)) throw new Error("Нет reminders[]");
        $("#default-tz").value = data.timezone || "Europe/Moscow";
        reminders = data.reminders.map((x) => ({
          label: x.label || "",
          weekdays: Array.isArray(x.weekdays) ? x.weekdays : [0, 1, 2, 3, 4, 5, 6],
          event_hour: x.event_hour ?? 18,
          event_minute: x.event_minute ?? 0,
          remind_before_minutes: x.remind_before_minutes ?? 60,
          channel_id: String(x.channel_id ?? defaultChannelId()),
          timezone: x.timezone || data.timezone || "Europe/Moscow",
          role_ids_text: Array.isArray(x.role_ids) ? x.role_ids.join(",") : "",
        }));
        const allRids = new Set();
        data.reminders.forEach((x) => {
          (x.role_ids || []).forEach((rid) => allRids.add(String(rid)));
        });
        selectedRoleIds = allRids;
        renderReminders();
        renderRoleList();
        renderChips();
        $("#export-status").textContent = "Импорт из файла.";
        $("#export-status").className = "status-line ok";
      } catch (err) {
        $("#export-status").textContent = String(err.message || err);
        $("#export-status").className = "status-line err";
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  });

  bootAfterHash().then(() => {
    updateAuthUi();
    if (!base) {
      showGate("Укажи в site-config.js GLOBAL_REMINDERS_API_BASE (публичный HTTPS URL бота).");
      return;
    }
    if (!getJwt()) {
      $("#app-main")?.classList.add("hidden");
      showGate("Нажми «Войти через Discord». Доступ только у Гл. и Ст. ивентологов.");
      return;
    }
    openMain();
  });
}

document.addEventListener("DOMContentLoaded", init);
