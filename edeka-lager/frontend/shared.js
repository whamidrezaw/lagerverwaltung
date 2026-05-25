/* ═══════════════════════════════════════════════════════════════
   EDEKA Lagerverwaltung — Shared JS
   شامل: Auth check, User init, Theme toggle,
         Sidebar, API helper, Toast, CSV export,
         Number animation, Date formatting
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── 1. AUTH GUARD ──────────────────────────────────────────── */
const token = sessionStorage.getItem('token');
if (!token) {
  window.location.href = '/index.html';
}

/* ── 2. CURRENT USER ────────────────────────────────────────── */
const currentUser = (() => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
})();

function initUserUI() {
  const name   = currentUser.name   || 'Administrator';
  const role   = currentUser.role   || 'lagerist';
  const avatar = name[0].toUpperCase();

  const elName   = document.getElementById('user-name-display');
  const elRole   = document.getElementById('user-role-display');
  const elAvatar = document.getElementById('user-avatar');
  const elDate   = document.getElementById('topbar-date');

  if (elName)   elName.textContent   = name;
  if (elRole)   elRole.textContent   = role;
  if (elAvatar) elAvatar.textContent = avatar;
  if (elDate)   elDate.textContent   = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ── 3. THEME TOGGLE ────────────────────────────────────────── */
function initTheme() {
  const root   = document.documentElement;
  const btns   = document.querySelectorAll('[data-theme-toggle]');
  let   theme  = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';

  const SVG_SUN  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>`;
  const SVG_MOON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    btns.forEach(btn => {
      btn.innerHTML   = t === 'dark' ? SVG_SUN : SVG_MOON;
      btn.setAttribute('aria-label', t === 'dark' ? 'Hell-Modus' : 'Dunkel-Modus');
    });
  }

  applyTheme(theme);
  btns.forEach(btn => btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
  }));
}

/* ── 4. SIDEBAR ─────────────────────────────────────────────── */
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const menuBtn  = document.querySelector('.menu-toggle');

  if (!sidebar) return;

  function open()  { sidebar.classList.add('open');  if (overlay) overlay.classList.add('open');  }
  function close() { sidebar.classList.remove('open'); if (overlay) overlay.classList.remove('open'); }
  function toggle() { sidebar.classList.contains('open') ? close() : open(); }

  if (menuBtn)  menuBtn.addEventListener('click', toggle);
  if (overlay)  overlay.addEventListener('click', close);

  // Escape key
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Expose برای onclick در HTML
  window.toggleSidebar = toggle;
  window.closeSidebar  = close;
}

/* ── 5. ORDER BADGE ─────────────────────────────────────────── */
async function loadOrderBadge() {
  try {
    const data = await api('/api/reports/order-suggestions');
    if (!data) return;
    const count = data.meta?.totalItems ?? data.suggestions?.length ?? 0;
    const badge = document.getElementById('order-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent     = count;
      badge.style.display   = 'inline';
    } else {
      badge.style.display   = 'none';
    }
  } catch {
    /* badge bleibt versteckt */
  }
}

/* ── 6. API HELPER ──────────────────────────────────────────── */
/**
 * Zentraler fetch-Wrapper mit Auth + Error Handling.
 * @param {string} path   — API-Pfad z.B. '/api/reports/history'
 * @param {string} method — HTTP-Methode (default: 'GET')
 * @param {*}      body   — JSON-Body (optional)
 * @returns {Promise<any>} Parsed JSON oder null bei 401
 * @throws {Error} bei HTTP-Fehler (4xx/5xx)
 */
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(path, opts);
  } catch (networkErr) {
    throw new Error('Netzwerkfehler: ' + networkErr.message);
  }

  // 401 → logout
  if (res.status === 401) {
    logout();
    return null;
  }

  // JSON parsen (auch bei Fehlern)
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data;
}

/* ── 7. LOGOUT ──────────────────────────────────────────────── */
function logout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = '/index.html';
}
window.logout = logout;

/* ── 8. TOAST ───────────────────────────────────────────────── */
/**
 * Zeigt eine Toast-Benachrichtigung an.
 * @param {string}  msg       — Text (plain text, kein HTML)
 * @param {'info'|'ok'|'err'} type — optional
 * @param {number}  duration  — ms (default 2600)
 */
function showToast(msg, type = 'info', duration = 2600) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;

  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg; // ← textContent (nicht innerHTML) → XSS-sicher

  if (type === 'ok')  t.style.background = 'var(--color-success)';
  if (type === 'err') t.style.background = 'var(--color-error)';

  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s';
    t.style.opacity    = '0';
    setTimeout(() => t.remove(), 320);
  }, duration);
}
window.showToast = showToast;

/* ── 9. NUMBER ANIMATION ────────────────────────────────────── */
/**
 * Animiert eine Zahl von ihrem aktuellen Wert zum Zielwert.
 * @param {string} id      — Element-ID
 * @param {number} target  — Zielwert
 * @param {string} suffix  — optionaler Suffix z.B. '%'
 */
function animVal(id, target, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  let   step  = 0;
  const total = 14;
  const iv    = setInterval(() => {
    step++;
    el.textContent = Math.round(start + diff * step / total) + suffix;
    if (step >= total) {
      el.textContent = target + suffix;
      clearInterval(iv);
    }
  }, 16);
}
window.animVal = animVal;

/* ── 10. DATE HELPERS ───────────────────────────────────────── */
/**
 * Relativer Zeitstempel: "vor 5 Min.", "Heute 14:32", "23. Mai"
 */
function fmtRelative(iso) {
  if (!iso) return '—';
  const d   = new Date(iso);
  const now = new Date();
  const diffMs  = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1)   return 'Gerade eben';
  if (diffMin < 60)  return `vor ${diffMin} Min.`;
  if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60);
    return `vor ${h} Std.`;
  }
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit'
  });
}

window.fmtRelative = fmtRelative;
window.fmtDate     = fmtDate;
window.fmtTime     = fmtTime;

/* ── 11. CSV DOWNLOAD ───────────────────────────────────────── */
/**
 * Erstellt und lädt eine CSV-Datei herunter.
 * @param {Array<Array>} rows     — Zeilen als Array von Arrays
 * @param {string}       filename — Dateiname mit .csv
 */
function downloadCSV(rows, filename) {
  const BOM = '\uFEFF'; // ← korrekt (nicht \\uFEFF)
  const csv = BOM + rows
    .map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
window.downloadCSV = downloadCSV;

/* ── 12. TELEGRAM REPORT (Sidebar-Button) ───────────────────── */
async function sendTelegramReport() {
  showToast('📱 Telegram-Bericht wird gesendet…');
  try {
    await api('/api/reports/telegram', 'POST');
    showToast('✅ Bericht erfolgreich gesendet!', 'ok');
  } catch (e) {
    showToast('⚠️ ' + e.message, 'err');
  }
}
window.sendTelegramReport = sendTelegramReport;

/* ── 13. USER AGENT PARSER ──────────────────────────────────── */
function parseUA(ua) {
  if (!ua)                                  return 'Unbekannt';
  if (ua.includes('curl'))                  return '⌨️ Terminal';
  if (ua.includes('iPhone') || ua.includes('Android')) return '📱 Mobil';
  if (ua.includes('Chrome'))                return '💻 Chrome';
  if (ua.includes('Firefox'))               return '🦊 Firefox';
  if (ua.includes('Safari'))                return '🧭 Safari';
  return '💻 Browser';
}
window.parseUA = parseUA;

/* ── INIT (automatisch beim Laden) ─────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  initTheme();
  initSidebar();
  loadOrderBadge();
});
