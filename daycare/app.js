// ===== Daycare Duty =====
// Two-parent planner for daycare drop-off (AM) and pickup (PM) slots.
// Offline-first (localStorage), optional sync via a private GitHub repo.

const STATE_KEY = 'dd_state';
const SYNC_KEY = 'dd_sync';
const SYNC_PATH = 'daycare-schedule.json';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Slot owners: 'p1' | 'p2' | 'none' (explicitly nobody) | 'auto' (use typical week)
const CYCLE = ['auto', 'p1', 'p2', 'none'];

let state = loadState();
let syncCfg = loadSyncCfg();
let weekStart = mondayOf(new Date());
let syncTimer = null;
let syncing = false;

// ---------- State ----------

function defaultState() {
  return {
    settings: {
      parents: { p1: { name: 'Dad' }, p2: { name: 'Mom' } },
      // typical week, keyed by JS weekday (1=Mon ... 5=Fri); weekends default empty
      defaults: {
        1: { am: 'p1', pm: 'p2' },
        2: { am: 'p1', pm: 'p2' },
        3: { am: 'p1', pm: 'p2' },
        4: { am: 'p1', pm: 'p2' },
        5: { am: 'p1', pm: 'p2' },
        6: { am: 'none', pm: 'none' },
        0: { am: 'none', pm: 'none' },
      },
      showWeekends: false,
      pinHash: null,
      ts: 0,
    },
    slots: {}, // 'YYYY-MM-DD' -> { am: {owner, ts}, pm: {owner, ts} }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        settings: { ...base.settings, ...parsed.settings,
          parents: { ...base.settings.parents, ...(parsed.settings?.parents || {}) },
          defaults: { ...base.settings.defaults, ...(parsed.settings?.defaults || {}) } },
        slots: parsed.slots || {},
      };
    }
  } catch (e) { /* fall through to fresh state */ }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadSyncCfg() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY)) || null;
  } catch (e) { return null; }
}

function saveSyncCfg() {
  if (syncCfg) localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg));
  else localStorage.removeItem(SYNC_KEY);
}

// ---------- Dates ----------

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - shift);
  return out;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// ---------- Slot logic ----------

function getOverride(dateKey, slot) {
  return state.slots[dateKey]?.[slot]?.owner ?? 'auto';
}

function effectiveOwner(date, slot) {
  const ov = getOverride(fmtDate(date), slot);
  if (ov !== 'auto') return ov;
  return state.settings.defaults[date.getDay()]?.[slot] || 'none';
}

function cycleSlot(dateKey, slot) {
  const cur = getOverride(dateKey, slot);
  const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
  if (!state.slots[dateKey]) state.slots[dateKey] = {};
  state.slots[dateKey][slot] = { owner: next, ts: Date.now() };
  saveState();
  render();
  queueSync();
}

// ---------- Rendering ----------

function parentName(id) {
  if (id === 'p1' || id === 'p2') return state.settings.parents[id].name || id;
  return null;
}

function render() {
  renderLegend();
  renderBalance();
  renderWeek();
}

function renderLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = ['p1', 'p2'].map(id => `
    <span class="legend-chip">
      <span class="dot" style="background: var(--${id})"></span>
      ${esc(parentName(id))}
    </span>`).join('');
}

function renderBalance() {
  // tally the calendar month containing the viewed week's Monday
  const y = weekStart.getFullYear();
  const m = weekStart.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const counts = { p1: 0, p2: 0 };
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    if (!state.settings.showWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue;
    for (const slot of ['am', 'pm']) {
      const o = effectiveOwner(d, slot);
      if (o === 'p1' || o === 'p2') counts[o]++;
    }
  }
  const total = counts.p1 + counts.p2;
  const pct1 = total ? (counts.p1 / total) * 100 : 50;
  document.getElementById('balanceCard').innerHTML = `
    <p class="balance-title">${MONTH_NAMES[m]} balance</p>
    <div class="balance-bar">
      <div class="seg-p1" style="width:${pct1}%"></div>
      <div class="seg-p2" style="width:${100 - pct1}%"></div>
    </div>
    <div class="balance-counts">
      <span><strong>${counts.p1}</strong> ${esc(parentName('p1'))}</span>
      <span><strong>${counts.p2}</strong> ${esc(parentName('p2'))}</span>
    </div>`;
}

function renderWeek() {
  const days = state.settings.showWeekends ? 7 : 5;
  const end = addDays(weekStart, days - 1);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const label = sameMonth
    ? `${MONTH_NAMES[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${end.getDate()}`
    : `${MONTH_NAMES[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
  document.getElementById('weekLabel').innerHTML =
    `${label}<span class="sub">${weekStart.getFullYear()} · tap for today</span>`;

  const todayKey = fmtDate(new Date());
  const list = document.getElementById('daysList');
  list.innerHTML = '';

  for (let i = 0; i < days; i++) {
    const d = addDays(weekStart, i);
    const key = fmtDate(d);
    const card = document.createElement('div');
    card.className = 'day-card';
    if (key === todayKey) card.classList.add('today');
    else if (key < todayKey) card.classList.add('past');

    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML = `
      <span class="day-name">${WEEKDAY_NAMES[d.getDay()]}</span>
      <span class="day-date">${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}</span>
      ${key === todayKey ? '<span class="today-tag">Today</span>' : ''}`;
    card.appendChild(head);

    const row = document.createElement('div');
    row.className = 'slot-row';
    for (const [slot, label, icon] of [['am', 'Drop-off', '\u{1F305}'], ['pm', 'Pickup', '\u{1F319}']]) {
      const owner = effectiveOwner(d, slot);
      const isDefault = getOverride(key, slot) === 'auto';
      const btn = document.createElement('button');
      btn.className = `slot owner-${owner === 'none' ? 'none' : owner}${isDefault ? ' is-default' : ''}`;
      btn.innerHTML = `
        <span class="slot-label">${icon} ${label}</span>
        <span class="slot-owner">${owner === 'none' ? '—' : esc(parentName(owner))}</span>
        ${isDefault && owner !== 'none' ? '<span class="auto-tag">usual</span>' : ''}`;
      btn.addEventListener('click', () => cycleSlot(key, slot));
      row.appendChild(btn);
    }
    card.appendChild(row);
    list.appendChild(card);
  }
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

// ---------- Settings ----------

function openSettings() {
  document.getElementById('nameP1').value = state.settings.parents.p1.name;
  document.getElementById('nameP2').value = state.settings.parents.p2.name;
  document.getElementById('showWeekends').checked = state.settings.showWeekends;
  renderDefaultsGrid();
  refreshPinButtons();
  refreshSyncUI('');
  document.getElementById('settingsModal').classList.add('open');
}

function renderDefaultsGrid() {
  const grid = document.getElementById('defaultsGrid');
  grid.innerHTML = '<span></span><span class="grid-head">Drop-off</span><span class="grid-head">Pickup</span>';
  const weekdays = state.settings.showWeekends ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5];
  for (const wd of weekdays) {
    const lbl = document.createElement('span');
    lbl.className = 'day-label';
    lbl.textContent = WEEKDAY_NAMES[wd].slice(0, 3);
    grid.appendChild(lbl);
    for (const slot of ['am', 'pm']) {
      const sel = document.createElement('select');
      sel.dataset.wd = wd;
      sel.dataset.slot = slot;
      sel.innerHTML = `
        <option value="none">—</option>
        <option value="p1">${esc(parentName('p1'))}</option>
        <option value="p2">${esc(parentName('p2'))}</option>`;
      sel.value = state.settings.defaults[wd]?.[slot] || 'none';
      grid.appendChild(sel);
    }
  }
}

function commitSettings() {
  const s = state.settings;
  s.parents.p1.name = document.getElementById('nameP1').value.trim() || 'Parent 1';
  s.parents.p2.name = document.getElementById('nameP2').value.trim() || 'Parent 2';
  s.showWeekends = document.getElementById('showWeekends').checked;
  document.querySelectorAll('#defaultsGrid select').forEach(sel => {
    const wd = sel.dataset.wd;
    if (!s.defaults[wd]) s.defaults[wd] = { am: 'none', pm: 'none' };
    s.defaults[wd][sel.dataset.slot] = sel.value;
  });
  s.ts = Date.now();
  saveState();
  render();
  queueSync();
}

// ---------- PIN ----------

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function refreshPinButtons() {
  const has = !!state.settings.pinHash;
  document.getElementById('setPinBtn').textContent = has ? 'Change PIN' : 'Set PIN';
  document.getElementById('removePinBtn').classList.toggle('hidden', !has);
}

let pinEntry = '';

function showLockScreen() {
  const pad = document.getElementById('pinPad');
  pad.innerHTML = '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  for (const k of keys) {
    const b = document.createElement('button');
    b.textContent = k;
    if (k === '') b.className = 'ghost';
    else b.addEventListener('click', () => pinKey(k));
    pad.appendChild(b);
  }
  pinEntry = '';
  renderPinDots();
  document.getElementById('lockScreen').classList.remove('hidden');
}

function renderPinDots() {
  document.getElementById('pinDots').innerHTML =
    pinEntry.split('').map(() => '<span class="pd fill"></span>').join('') +
    Array(Math.max(0, 4 - pinEntry.length)).fill('<span class="pd"></span>').join('');
}

async function pinKey(k) {
  const hint = document.getElementById('lockHint');
  if (k === '⌫') {
    pinEntry = pinEntry.slice(0, -1);
  } else if (pinEntry.length < 6) {
    pinEntry += k;
  }
  renderPinDots();
  if (pinEntry.length >= 4) {
    const hash = await sha256Hex(pinEntry);
    if (hash === state.settings.pinHash) {
      document.getElementById('lockScreen').classList.add('hidden');
      pinEntry = '';
    } else if (pinEntry.length === 6) {
      pinEntry = '';
      renderPinDots();
      hint.textContent = 'Wrong PIN, try again';
      hint.classList.add('shake');
      setTimeout(() => { hint.textContent = 'Enter your family PIN'; hint.classList.remove('shake'); }, 1500);
    }
  }
}

// ---------- Sync (private GitHub repo, Contents API) ----------

function setSyncDot(cls) {
  document.getElementById('syncDot').className = 'sync-dot' + (cls ? ' ' + cls : '');
}

function refreshSyncUI(msg, cls) {
  const connected = !!syncCfg;
  document.getElementById('syncRepo').value = syncCfg?.repo || '';
  document.getElementById('syncToken').value = syncCfg?.token || '';
  document.getElementById('connectSyncBtn').classList.toggle('hidden', connected);
  document.getElementById('syncNowBtn').classList.toggle('hidden', !connected);
  document.getElementById('disconnectSyncBtn').classList.toggle('hidden', !connected);
  const st = document.getElementById('syncStatus');
  st.textContent = msg || (connected ? `Connected to ${syncCfg.repo}` : 'Not connected — data stays on this device.');
  st.className = 'sync-status' + (cls ? ' ' + cls : '');
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function apiUrl() {
  return `https://api.github.com/repos/${syncCfg.repo}/contents/${SYNC_PATH}`;
}

function apiHeaders() {
  return {
    'Authorization': `Bearer ${syncCfg.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Per-slot merge: newest timestamp wins; settings merged as a whole by ts.
function mergeRemote(remote) {
  if (!remote || typeof remote !== 'object') return;
  if (remote.settings && (remote.settings.ts || 0) > (state.settings.ts || 0)) {
    state.settings = { ...defaultState().settings, ...remote.settings };
  }
  for (const [date, slots] of Object.entries(remote.slots || {})) {
    for (const slot of ['am', 'pm']) {
      const r = slots?.[slot];
      if (!r) continue;
      const l = state.slots[date]?.[slot];
      if (!l || (r.ts || 0) > (l.ts || 0)) {
        if (!state.slots[date]) state.slots[date] = {};
        state.slots[date][slot] = r;
      }
    }
  }
}

function queueSync() {
  if (!syncCfg) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 2000);
}

async function syncNow(interactive) {
  if (!syncCfg || syncing) return;
  syncing = true;
  setSyncDot('busy');
  if (interactive) refreshSyncUI('Syncing…');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      // pull
      let sha = null;
      const res = await fetch(apiUrl(), { headers: apiHeaders(), cache: 'no-store' });
      if (res.ok) {
        const file = await res.json();
        sha = file.sha;
        try { mergeRemote(JSON.parse(b64decode(file.content))); } catch (e) { /* unreadable remote: overwrite */ }
        saveState();
        render();
      } else if (res.status !== 404) {
        throw new Error(res.status === 401 ? 'Token rejected (401)' :
          res.status === 403 ? 'Access denied (403) — check token permissions' :
          res.status === 404 ? 'Repo or file not found' : `GitHub error ${res.status}`);
      }
      // push merged state
      const body = {
        message: 'Update daycare schedule',
        content: b64encode(JSON.stringify({ settings: state.settings, slots: state.slots })),
      };
      if (sha) body.sha = sha;
      const put = await fetch(apiUrl(), {
        method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body),
      });
      if (put.ok) {
        setSyncDot('ok');
        if (document.getElementById('settingsModal').classList.contains('open')) {
          refreshSyncUI(`Synced ✓ ${new Date().toLocaleTimeString()}`, 'ok');
        }
        syncing = false;
        return;
      }
      if (put.status !== 409 && put.status !== 422) {
        throw new Error(put.status === 401 ? 'Token rejected (401)' :
          put.status === 403 ? 'Write denied (403) — token needs Contents read/write' :
          `GitHub error ${put.status}`);
      }
      // conflict: someone else pushed between our pull and push; loop to re-pull and re-merge
    }
    throw new Error('Sync conflict — try again');
  } catch (e) {
    setSyncDot('error');
    refreshSyncUI(`Sync failed: ${e.message}`, 'error');
  } finally {
    syncing = false;
  }
}

async function connectSync() {
  const repo = document.getElementById('syncRepo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  const token = document.getElementById('syncToken').value.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    refreshSyncUI('Enter the repo as owner/name', 'error');
    document.getElementById('syncRepo').value = repo;
    return;
  }
  if (!token) {
    refreshSyncUI('Paste your access token', 'error');
    return;
  }
  syncCfg = { repo, token };
  saveSyncCfg();
  await syncNow(true);
}

function disconnectSync() {
  syncCfg = null;
  saveSyncCfg();
  setSyncDot('');
  refreshSyncUI('Disconnected. Your data is still on this device.');
}

// ---------- Backup ----------

function exportData() {
  const blob = new Blob([JSON.stringify({ settings: state.settings, slots: state.slots }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `daycare-duty-${fmtDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      mergeRemote(data);
      saveState();
      render();
      queueSync();
      alert('Import complete.');
    } catch (e) {
      alert('Could not read that file.');
    }
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------

function init() {
  if (state.settings.pinHash) showLockScreen();

  document.getElementById('prevWeek').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7); render();
  });
  document.getElementById('nextWeek').addEventListener('click', () => {
    weekStart = addDays(weekStart, 7); render();
  });
  document.getElementById('weekLabel').addEventListener('click', () => {
    weekStart = mondayOf(new Date()); render();
  });

  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettingsModal').addEventListener('click', () => {
    commitSettings();
    document.getElementById('settingsModal').classList.remove('open');
  });
  document.getElementById('showWeekends').addEventListener('change', () => {
    state.settings.showWeekends = document.getElementById('showWeekends').checked;
    renderDefaultsGrid();
  });

  // PIN
  document.getElementById('setPinBtn').addEventListener('click', () => {
    document.getElementById('pinModalTitle').textContent =
      state.settings.pinHash ? 'Change Family PIN' : 'Set Family PIN';
    document.getElementById('pinForm').reset();
    document.getElementById('pinModal').classList.add('open');
  });
  document.getElementById('closePinModal').addEventListener('click', () => {
    document.getElementById('pinModal').classList.remove('open');
  });
  document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value;
    const confirm = document.getElementById('pinConfirm').value;
    if (!/^\d{4,6}$/.test(pin)) { alert('PIN must be 4–6 digits.'); return; }
    if (pin !== confirm) { alert('PINs do not match.'); return; }
    state.settings.pinHash = await sha256Hex(pin);
    state.settings.ts = Date.now();
    saveState();
    refreshPinButtons();
    queueSync();
    document.getElementById('pinModal').classList.remove('open');
  });
  document.getElementById('removePinBtn').addEventListener('click', () => {
    state.settings.pinHash = null;
    state.settings.ts = Date.now();
    saveState();
    refreshPinButtons();
    queueSync();
  });

  // Sync
  document.getElementById('connectSyncBtn').addEventListener('click', connectSync);
  document.getElementById('syncNowBtn').addEventListener('click', () => syncNow(true));
  document.getElementById('disconnectSyncBtn').addEventListener('click', disconnectSync);

  // Backup
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // background sync triggers
  if (syncCfg) {
    setSyncDot('ok');
    syncNow();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && syncCfg) syncNow();
  });

  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
