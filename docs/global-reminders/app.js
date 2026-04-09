/**
 * Редактор расписания напоминаний о глобалах.
 * Роли: сначала HTTP бота (site-config.js), иначе локальная выгрузка рядом со страницей.
 */

const WD_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const ROLE_LIST_FILE = "roles.json";
const EXPORT_FILENAME = "расписание-глобалов.json";
const DEFAULT_GUILD_ID = "1100793897933885515";

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
  status.textContent = "Загрузка списка ролей…";
  status.className = "status-bar";

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
        status.textContent = `Загружено ролей: ${allRoles.length} (с сервера бота)`;
        status.className = "status-bar ok";
        renderRoleList();
        return;
      }
      hint = `Бот: HTTP ${res.status}. `;
    } catch (e) {
      hint = `Бот: ${String(e.message || e)}. `;
    }
  }

  try {
    const res = await fetch(`./${ROLE_LIST_FILE}`, { cache: "no-store" });
    if (!res.ok) throw new Error(hint + `Локальный файл: HTTP ${res.status}`);
    data = await res.json();
    applyRolesPayload(data);
    status.textContent = `Загружено ролей: ${allRoles.length}`;
    status.className = "status-bar ok";
    renderRoleList();
  } catch (e) {
    allRoles = [];
    status.textContent =
      hint +
      "Не удалось получить роли. В site-config.js укажи публичный HTTPS-адрес хоста бота (тот же порт, что слушает aiohttp), либо положи выгрузку от бота рядом со страницей. Страница с GitHub Pages должна открываться по HTTPS, если бот тоже по HTTPS. " +
      String(e.message || e);
    status.className = "status-bar err";
    renderRoleList();
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
    box.innerHTML =
      '<div class="role-item" style="cursor:default;color:var(--muted)">Нет совпадений</div>';
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
    host.innerHTML = '<span style="color:var(--muted);font-size:0.9rem">Ничего не выбрано</span>';
    return;
  }
  host.innerHTML = ids
    .map((id) => {
      const r = allRoles.find((x) => String(x.id) === id);
      const name = r ? r.name : id;
      return `<span class="chip">${escapeHtml(name)} <button type="button" data-rid="${escapeHtml(id)}" aria-label="Убрать">×</button></span>`;
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
    channel_id: "",
    timezone: $("#default-tz")?.value?.trim() || "Europe/Moscow",
    /** если пусто — берутся чекбоксы из списка ролей */
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
        return `<label class="weekday-lbl"><input type="checkbox" class="chk-site" data-wd="${i}" ${on ? "checked" : ""} /> ${lab}</label>`;
      }).join("");

      const rolesVal = escapeHtml(r.role_ids_text || "");

      return `<div class="reminder-card" data-idx="${idx}">
        <h3>Строка ${idx + 1}</h3>
        <div class="grid grid-2">
          <label class="field">Подпись
            <input type="text" class="in-label" value="${escapeHtml(r.label)}" placeholder="Вечерний глобал" />
          </label>
          <label class="field">ID канала <span class="hint">куда слать пинг</span>
            <input type="text" class="in-channel" value="${escapeHtml(String(r.channel_id))}" placeholder="1449381523005374565" />
          </label>
          <label class="field">Время ивента
            <input type="time" class="in-time" value="${String(r.event_hour).padStart(2, "0")}:${String(r.event_minute).padStart(2, "0")}" />
          </label>
          <label class="field">За сколько минут до ивента пинг
            <input type="number" class="in-before" min="1" max="1440" value="${r.remind_before_minutes}" />
          </label>
          <label class="field">Часовой пояс (IANA)
            <input type="text" class="in-tz" value="${escapeHtml(r.timezone || "Europe/Moscow")}" />
          </label>
          <label class="field" style="grid-column:1/-1">ID ролей для этой строки <span class="hint">пусто = взять выбранные в списке выше</span>
            <input type="text" class="in-roles" value="${rolesVal}" placeholder="123,456 или оставь пустым" />
          </label>
        </div>
        <label class="field" style="margin-top:0.75rem">Дни недели (по времени ивента)</label>
        <div class="weekdays in-weekdays">${wdChecks}</div>
        <div class="btn-row">
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
  });
}

function collectExport() {
  const tz = $("#default-tz")?.value?.trim() || "Europe/Moscow";
  const out = {
    schema: 1,
    timezone: tz,
    reminders: [],
  };

  document.querySelectorAll(".reminder-card").forEach((card, idx) => {
    const r = reminders[idx];
    if (!r) return;
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
    if (!ch || !roleIds.length) return;

    const emins = (h || 0) * 60 + (m || 0);
    if (emins < before) {
      throw new Error(
        `Строка «${r.label || idx + 1}»: время ивента раньше, чем за ${before} мин — бот такие правила не принимает. Уменьши «за сколько минут» или сдвинь время ивента.`
      );
    }

    out.reminders.push({
      label: (card.querySelector(".in-label")?.value || "").trim() || "Глобал",
      weekdays: [...r.weekdays].sort((a, b) => a - b),
      event_hour: h || 0,
      event_minute: m || 0,
      remind_before_minutes: before,
      channel_id: parseInt(ch, 10),
      role_ids: roleIds,
      timezone: (card.querySelector(".in-tz")?.value || "").trim() || tz,
    });
  });

  if (!out.reminders.length) {
    throw new Error("Добавь канал и выбери роли — нечего экспортировать.");
  }
  return out;
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function init() {
  $("#role-search")?.addEventListener("input", () => renderRoleList());

  $("#btn-add-row")?.addEventListener("click", () => {
    reminders.push(emptyReminder());
    renderReminders();
  });

  $("#btn-export")?.addEventListener("click", () => {
    const st = $("#export-status");
    try {
      const data = collectExport();
      downloadJson(EXPORT_FILENAME, data);
      st.textContent = "Файл скачан — отправь его боту: /global_reminders_import";
      st.className = "status-bar ok";
    } catch (e) {
      st.textContent = String(e.message || e);
      st.className = "status-bar err";
    }
  });

  $("#btn-import-file")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.reminders || !Array.isArray(data.reminders)) throw new Error("В файле нет списка напоминаний");
        $("#default-tz").value = data.timezone || "Europe/Moscow";
        reminders = data.reminders.map((x) => ({
          label: x.label || "",
          weekdays: Array.isArray(x.weekdays) ? x.weekdays : [0, 1, 2, 3, 4, 5, 6],
          event_hour: x.event_hour ?? 18,
          event_minute: x.event_minute ?? 0,
          remind_before_minutes: x.remind_before_minutes ?? 60,
          channel_id: String(x.channel_id ?? ""),
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
        $("#export-status").textContent = "Импорт из файла выполнен (проверь чекбоксы ролей).";
        $("#export-status").className = "status-bar ok";
      } catch (err) {
        $("#export-status").textContent = String(err.message || err);
        $("#export-status").className = "status-bar err";
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  });

  loadRoles();
  renderReminders();
  renderChips();
}

document.addEventListener("DOMContentLoaded", init);
