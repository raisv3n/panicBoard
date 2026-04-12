/* ─── SVG Icons ──────────────────────────────────────────────────────────────── */
const ICON = {
  star: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>',
  calendar: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg>',
  docDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>',
  pencil: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg>',
};

/* ─── State ─────────────────────────────────────────────────────────────────── */
const STORAGE_KEY      = 'panicboard_v1';
const THEME_KEY        = 'panicboard_theme';
const NOTES_KEY        = 'panicboard_note';
const STALE_THRESHOLD  = 3 * 60 * 1000; // 3 minutes

let tasks                = [];
let currentView          = 'kanban';
let editingId            = null;
let deletingId           = null;
let resettingColId       = null;
let draggedId            = null;
let dragPlaceholder      = null;
let historyStack         = [];
let lastRefreshTimestamp = null;
let countdownInterval    = null;
const HISTORY_LIMIT      = 20;
const countingDownIds    = new Set(); // tasks actively being counted down this session

function pushHistory() {
  historyStack.push({ tasks: JSON.parse(JSON.stringify(tasks)) });
  if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
}

function undo() {
  if (!historyStack.length) return;
  tasks = historyStack.pop().tasks;
  saveTasks();
  renderBoard();
}

/* ─── Bootstrap ─────────────────────────────────────────────────────────────── */
function init() {
  loadTheme();
  loadNote();
  loadTasks();
  setDefaultDate();
  renderBoard();
  startClock();
  stampRefresh();
  checkPendingNotification();
  startCountdownTicker();
  initBoardDragScroll();
}

/* ─── Theme ─────────────────────────────────────────────────────────────────── */
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
}

const SUN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>';
const MOON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>';

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
  syncMobileThemeIcon();
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/* ─── Persistence ───────────────────────────────────────────────────────────── */
function loadTasks() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { tasks = []; }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* ─── Date Helpers ──────────────────────────────────────────────────────────── */
function todayStr() {
  return fmtDate(new Date());
}

function fmtDate(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

function colDate(dateStr) {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortDate(dateStr) {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/* ─── Task State ─────────────────────────────────────────────────────────────── */
function getDeadlineMs(task) {
  if (!task.dueDate) return Infinity;
  const time = task.dueTime || '23:59';
  return new Date(`${task.dueDate}T${time}:00`).getTime();
}

function calculateTaskState(task) {
  if (!task.dueDate) return { label: '—', cls: '', pulsing: false };
  const now  = Date.now();
  const dead = getDeadlineMs(task);
  const diff = dead - now;

  if (diff < 0) {
    const abs  = -diff;
    const d    = Math.floor(abs / 864e5);
    const h    = Math.floor((abs % 864e5) / 36e5);
    const m    = Math.floor((abs % 36e5) / 6e4);
    const hTot = Math.floor(abs / 36e5);
    const mTot = Math.floor(abs / 6e4);
    let label;
    if (d >= 1) {
      label = h > 0 && m > 0 ? `⚠️ ${d}d ${h}h ${m}m overdue`
            : h > 0           ? `⚠️ ${d}d ${h}h overdue`
            : m > 0           ? `⚠️ ${d}d ${m}m overdue`
            :                   `⚠️ ${d}d overdue`;
    } else {
      label = hTot >= 1 ? `⚠️ ${hTot}h ${m}m overdue` : `⚠️ ${mTot}m overdue`;
    }
    return { label, cls: 'overdue', pulsing: false };
  }

  const secs  = Math.floor(diff / 1000);
  const mTot  = Math.floor(diff / 6e4);
  const hTot  = Math.floor(diff / 36e5);
  const d     = Math.floor(diff / 864e5);
  const h     = Math.floor((diff % 864e5) / 36e5);
  const m     = Math.floor((diff % 36e5) / 6e4);

  if (secs < 60)   return { label: `🔥 ${secs}s left`, cls: 'critical', pulsing: true };
  if (hTot < 1)    return { label: `🔥 ${mTot}m left`, cls: 'critical', pulsing: true };
  if (hTot < 24)   return {
    label: `🔥 ${hTot}h ${String(m).padStart(2, '0')}m left`,
    cls: 'critical', pulsing: false
  };
  if (d < 2)  return { label: `⏰ ${d}d ${h}h ${String(m).padStart(2, '0')}m`, cls: 'warning', pulsing: false };
  // >= 2 days: round to calendar days (Thu is always 3d from Mon regardless of time)
  const todayMid = new Date(todayStr() + 'T00:00:00').getTime();
  const dueMid   = new Date(task.dueDate + 'T00:00:00').getTime();
  const calDays  = Math.round((dueMid - todayMid) / 864e5);
  return { label: `✓ ${calDays}d left`, cls: 'safe', pulsing: false };
}

/* ─── Column Grouping ───────────────────────────────────────────────────────── */
function getColumnId(task) {
  if (task.isBacklog || !task.dueDate) return 'backlog';
  return getDeadlineMs(task) < Date.now() ? 'overdue' : task.dueDate;
}

function groupTasksByDate() {
  const t   = todayStr();
  const tom = addDays(t, 1);
  const now = Date.now();

  // Backlog is always first
  const cols = [{ id: 'backlog', label: 'Backlog', sub: 'Unscheduled', date: null, type: 'backlog' }];

  const hasOverdue = tasks.some(task => !task.isBacklog && task.dueDate && getDeadlineMs(task) < now);
  if (hasOverdue) {
    cols.push({ id: 'overdue', label: 'Overdue', sub: 'Past due', date: null, type: 'overdue' });
  }

  const uniqueDates = [...new Set(
    tasks
      .filter(task => !task.isBacklog && task.dueDate && getDeadlineMs(task) >= now)
      .map(task => task.dueDate)
  )].sort();

  for (const ds of uniqueDates) {
    const d = new Date(ds + 'T12:00:00');
    let label, type;

    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (ds === t)        { label = `Today, ${weekday}`;    type = 'today';    }
    else if (ds === tom) { label = `Tomorrow, ${weekday}`; type = 'tomorrow'; }
    else                 { label = weekday; type = 'future'; }

    cols.push({ id: ds, label, sub: colDate(ds), date: ds, type });
  }

  return cols;
}

/* ─── Render ─────────────────────────────────────────────────────────────────── */
function renderBoard() {
  if (currentView === 'kanban') renderKanban();
  else renderTimeline();

  document.getElementById('empty-hint')
    .classList.toggle('hidden', tasks.length > 0);

  // Refresh nav arrow visibility after content changes
  updateNavButtons();
}

/* ─── Stale Indicator ────────────────────────────────────────────────────────── */
function stampRefresh() {
  lastRefreshTimestamp = Date.now();
  renderStaleIndicator();
}

function formatTimeAgo(ts) {
  const elapsed = Math.floor((Date.now() - ts) / 1000);
  if (elapsed < 60) return 'just now';
  const m = Math.floor(elapsed / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function renderStaleIndicator() {
  const el = document.getElementById('stale-indicator');
  if (!el) return;
  if (!lastRefreshTimestamp) { el.textContent = ''; return; }

  const isStale = (Date.now() - lastRefreshTimestamp) > STALE_THRESHOLD;
  el.textContent = isStale
    ? '⚠ Data may be outdated'
    : `Updated ${formatTimeAgo(lastRefreshTimestamp)}`;
  el.className = 'stale-indicator' + (isStale ? ' stale' : '');
}

/* ─── Manual Refresh ─────────────────────────────────────────────────────────── */
function handleRefresh() {
  const btn = document.getElementById('btn-refresh');
  if (btn) {
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 400);
  }
  renderBoard();
  stampRefresh();
}

/* ─── Countdown Ticker ───────────────────────────────────────────────────────── */
function startCountdownTicker() {
  if (countdownInterval) return; // only one instance
  countdownInterval = setInterval(tickCountdown, 1000);
}

function tickCountdown() {
  const now = Date.now();
  let expiredTask = null;

  for (const task of tasks) {
    const diff = getDeadlineMs(task) - now;

    // Not in sub-60s range — skip
    if (diff > 60000) continue;

    // Task has expired
    if (diff <= 0) {
      // Only act if we were actively counting this task down
      if (countingDownIds.has(task.id)) {
        expiredTask = task;
        countingDownIds.delete(task.id);
        break; // handle one per tick; reload will catch the rest
      }
      continue;
    }

    // 0 < diff <= 60s — register and patch DOM directly (no full re-render)
    countingDownIds.add(task.id);
    const cardEl = document.getElementById('card-' + task.id);
    if (!cardEl) continue;
    const cdEl = cardEl.querySelector('.card-countdown');
    if (cdEl) cdEl.textContent = `🔥 ${Math.ceil(diff / 1000)}s left`;
  }

  if (expiredTask) {
    // Persist notification across the upcoming reload
    localStorage.setItem('panicboard_pending_notif', JSON.stringify({
      message: `'${expiredTask.title}' moved to Overdue ⚠️`,
      ts: Date.now()
    }));
    window.location.reload();
  }
}

/* ─── Post-reload Notification ───────────────────────────────────────────────── */
function checkPendingNotification() {
  const raw = localStorage.getItem('panicboard_pending_notif');
  if (!raw) return;
  localStorage.removeItem('panicboard_pending_notif');
  try {
    const { message, ts } = JSON.parse(raw);
    // Only show if the reload happened very recently (within 6s)
    if (Date.now() - ts < 6000) showToast(message, 'overdue');
  } catch { /* malformed — discard silently */ }
}

/* ─── Kanban ─────────────────────────────────────────────────────────────────── */
function renderKanban() {
  const board  = document.getElementById('board');
  const tlView = document.getElementById('timeline-view');
  board.style.display = '';
  tlView.classList.add('hidden');

  const cols = groupTasksByDate();
  board.innerHTML = '';
  cols.forEach(col => {
    const colTasks = tasks
      .filter(t => getColumnId(t) === col.id)
      .sort((a, b) => {
      // 1. Priority first
      const impDiff = b.isImportant - a.isImportant;
      if (impDiff !== 0) return impDiff;
      // 2. Scheduled second
      const schDiff = b.isScheduled - a.isScheduled;
      if (schDiff !== 0) return schDiff;
      // 3. Manual order (if set on both)
      const aHas = a.manualOrder != null, bHas = b.manualOrder != null;
      if (aHas && bHas) return a.manualOrder - b.manualOrder;
      if (aHas) return -1;
      if (bHas) return 1;
      // 4. Fallback to deadline
      return getDeadlineMs(a) - getDeadlineMs(b);
    });
    board.appendChild(makeKanbanColumn(col, colTasks));
  });
}

function makeKanbanColumn(col, colTasks) {
  const el = document.createElement('div');
  el.className     = `column col-${col.type}`;
  el.dataset.colId = col.id;

  el.addEventListener('dragover', e => {
    e.preventDefault();
    if (col.type === 'overdue') return;
    el.classList.add('drag-over');
    const cardsEl = el.querySelector('.col-cards');
    if (!dragPlaceholder) return;
    // Insert placeholder at the nearest valid position
    const draggedTask    = tasks.find(t => t.id === draggedId);
    const afterEl        = getDragAfterElement(cardsEl, e.clientY, draggedTask?.isImportant, draggedTask?.isScheduled);
    if (afterEl == null) {
      cardsEl.appendChild(dragPlaceholder);
    } else {
      cardsEl.insertBefore(dragPlaceholder, afterEl);
    }
  });
  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (col.type === 'overdue') return;
    dropTaskIntoCol(col, el);
  });

  const iconSvg = {
    today:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;vertical-align:-1px"><path fill-rule="evenodd" d="M17.303 5.197A7.5 7.5 0 0 0 6.697 15.803a.75.75 0 0 1-1.061 1.061A9 9 0 1 1 21 10.5a.75.75 0 0 1-1.5 0c0-1.92-.732-3.839-2.197-5.303Zm-2.121 2.121a4.5 4.5 0 0 0-6.364 6.364.75.75 0 1 1-1.06 1.06A6 6 0 1 1 18 10.5a.75.75 0 0 1-1.5 0c0-1.153-.44-2.303-1.318-3.182Zm-3.634 1.314a.75.75 0 0 1 .82.311l5.228 7.917a.75.75 0 0 1-.777 1.148l-2.097-.43 1.045 3.9a.75.75 0 0 1-1.45.388l-1.044-3.899-1.601 1.42a.75.75 0 0 1-1.247-.606l.569-9.47a.75.75 0 0 1 .554-.68Z" clip-rule="evenodd"/></svg>',
    backlog: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;vertical-align:-1px"><path fill-rule="evenodd" d="M1.5 9.832v1.793c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875V9.832a3 3 0 0 0-.722-1.952l-3.285-3.832A3 3 0 0 0 16.215 3h-8.43a3 3 0 0 0-2.278 1.048L2.222 7.88A3 3 0 0 0 1.5 9.832ZM7.785 4.5a1.5 1.5 0 0 0-1.139.524L3.881 8.25h3.165a3 3 0 0 1 2.496 1.336l.164.246a1.5 1.5 0 0 0 1.248.668h2.092a1.5 1.5 0 0 0 1.248-.668l.164-.246a3 3 0 0 1 2.496-1.336h3.165l-2.765-3.226a1.5 1.5 0 0 0-1.139-.524h-8.43Z" clip-rule="evenodd"/><path d="M2.813 15c-.725 0-1.313.588-1.313 1.313V18a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-1.688c0-.724-.588-1.312-1.313-1.312h-4.233a3 3 0 0 0-2.496 1.336l-.164.246a1.5 1.5 0 0 1-1.248.668h-2.092a1.5 1.5 0 0 1-1.248-.668l-.164-.246A3 3 0 0 0 7.046 15H2.812Z"/></svg>',
    overdue: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;vertical-align:-1px"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd"/></svg>',
  };
  const icon = iconSvg[col.type] || '';
  const hasManual  = colTasks.some(t => t.manualOrder != null);
  const resetBtn   = hasManual
    ? `<button class="col-reset-btn" onclick="event.stopPropagation(); openResetOrderModal('${col.id}')" title="Reset to time order">↺</button>`
    : '';
  const addDate    = col.type === 'backlog' ? '' : (col.date || '');
  const addBtn     = col.type !== 'overdue'
    ? `<button class="col-add-btn" onclick="event.stopPropagation(); openModal('${addDate}')" title="Add task"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="5" y="1" width="2" height="10" rx="1"/><rect x="1" y="5" width="10" height="2" rx="1"/></svg></button>`
    : '';
  el.innerHTML = `
    <div class="col-header">
      <div class="col-title-group">
        <span class="col-label">${icon}${col.label}</span>
        <span class="col-sublabel">${col.sub}</span>
      </div>
      <div class="col-actions">
        <span class="col-badge">${colTasks.length}</span>
        ${addBtn}
        ${resetBtn}
      </div>
    </div>
    <div class="col-cards">
      ${colTasks.map(t => cardHTML(t)).join('')}
    </div>`;

  return el;
}

/* ─── Timeline ───────────────────────────────────────────────────────────────── */
function renderTimeline() {
  const board  = document.getElementById('board');
  const tlView = document.getElementById('timeline-view');
  board.style.display = 'none';
  tlView.classList.remove('hidden');

  const cols = groupTasksByDate();
  tlView.innerHTML = '';

  const scroll = document.createElement('div');
  scroll.className = 'timeline-scroll';

  const track = document.createElement('div');
  track.className = 'timeline-track';

  const axis = document.createElement('div');
  axis.className = 'timeline-axis';
  track.appendChild(axis);

  cols.forEach(col => {
    const colTasks = tasks
      .filter(t => getColumnId(t) === col.id)
      .sort((a, b) => {
      // 1. Priority first
      const impDiff = b.isImportant - a.isImportant;
      if (impDiff !== 0) return impDiff;
      // 2. Scheduled second
      const schDiff = b.isScheduled - a.isScheduled;
      if (schDiff !== 0) return schDiff;
      // 3. Manual order (if set on both)
      const aHas = a.manualOrder != null, bHas = b.manualOrder != null;
      if (aHas && bHas) return a.manualOrder - b.manualOrder;
      if (aHas) return -1;
      if (bHas) return 1;
      // 4. Fallback to deadline
      return getDeadlineMs(a) - getDeadlineMs(b);
    });

    const el = document.createElement('div');
    el.className       = `timeline-col t-${col.type}`;
    el.dataset.colId   = col.id;
    el.dataset.colDate = col.date || '';

    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (col.type === 'overdue') return;
      el.style.outline      = '2px dashed var(--accent)';
      el.style.borderRadius = '8px';
    });
    el.addEventListener('dragleave', () => {
      el.style.outline      = '';
      el.style.borderRadius = '';
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.outline      = '';
      el.style.borderRadius = '';
      if (col.type === 'overdue') return;
      dropTaskIntoCol(col);
    });

    el.innerHTML = `
      <div class="timeline-marker">
        <span class="timeline-label">${col.label}</span>
        <div class="timeline-dot"></div>
        <span class="timeline-date">${col.sub}</span>
      </div>
      <div class="timeline-cards">
        ${colTasks.map(t => cardHTML(t)).join('')}
      </div>`;

    track.appendChild(el);
  });

  scroll.appendChild(track);
  tlView.appendChild(scroll);
}

/* ─── Card HTML ──────────────────────────────────────────────────────────────── */
function cardHTML(task) {
  const state         = calculateTaskState(task);
  const pulsCls       = state.pulsing ? ' pulsing' : '';
  const tagCls        = task.tag === 'Deliverables' ? ' tag-deliverables' : '';
  const importantCls  = task.isImportant ? ' important' : '';
  const scheduledCls  = task.isScheduled ? ' scheduled' : '';
  const descPart = (() => {
    if (!task.description) return '';
    if (task.description.includes('\n')) {
      const lines = task.description.split('\n');
      const l1 = escHtml(lines[0]);
      const l2 = escHtml(lines[1]) + (lines.length > 2 ? '...' : '');
      return `<div class="card-desc card-desc--multiline"><span class="card-desc-line">${l1}</span><span class="card-desc-line">${l2}</span></div>`;
    }
    return `<div class="card-desc">${escHtml(task.description)}</div>`;
  })();
  const timePart   = task.dueDate && task.dueTime ? ` · ${fmtTime12(task.dueTime)}` : '';
  // Tags: Scheduled (lavender) first, Deliverables (blue) second
  const pillParts = [];
  if (task.isImportant)            pillParts.push(`<span class="card-tag-pill pill-important">${ICON.star} Priority</span>`);
  if (task.isScheduled)             pillParts.push(`<span class="card-tag-pill pill-scheduled">${ICON.calendar} Scheduled</span>`);
  if (task.tag === 'Deliverables') pillParts.push(`<span class="card-tag-pill pill-deliverables">${ICON.docDown} Deliverables</span>`);
  const tagPart = pillParts.length ? `<div class="card-tag">${pillParts.join('')}</div>` : '';

  return `
    <div class="card ${state.cls}${pulsCls}${tagCls}${importantCls}${scheduledCls}"
         id="card-${task.id}"
         draggable="true"
         onclick="openPreview('${task.id}')"
         ondragstart="handleDragStart(event,'${task.id}')"
         ondragend="handleDragEnd()">
      <div class="card-header">
        <span class="card-title">${escHtml(task.title)}</span>
        <div class="card-actions">
          <button class="card-btn"        onclick="event.stopPropagation(); openEdit('${task.id}')"   title="Edit">✎</button>
          <button class="card-btn delete" onclick="event.stopPropagation(); openDelete('${task.id}')" title="Delete">✕</button>
        </div>
      </div>
      ${tagPart}
      ${descPart}
      <div class="card-footer">
        <span class="card-countdown">${state.label}</span>
        <div class="card-meta">
          <span class="card-created">${task.dueDate ? shortDate(task.dueDate) + timePart : 'No date'}</span>
        </div>
      </div>
    </div>`;
}

/* ─── Drag & Drop ────────────────────────────────────────────────────────────── */
function handleDragStart(e, taskId) {
  draggedId = taskId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);

  dragPlaceholder = document.createElement('div');
  dragPlaceholder.className = 'card-placeholder';

  setTimeout(() => {
    const card = document.getElementById('card-' + taskId);
    if (card) card.classList.add('dragging');
  }, 0);
}

function handleDragEnd() {
  const card = document.getElementById('card-' + draggedId);
  if (card) card.classList.remove('dragging');
  if (dragPlaceholder) { dragPlaceholder.remove(); dragPlaceholder = null; }
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
  draggedId = null;
}

function dropTaskIntoCol(col, colEl) {
  if (!draggedId) return;
  if (col.type === 'overdue') return;
  const task = tasks.find(t => t.id === draggedId);
  if (!task) return;

  pushHistory();

  if (col.type === 'backlog') {
    // Drop into backlog: flag it, preserve existing date/time
    task.isBacklog   = true;
    task.manualOrder = null;
  } else if (task.isBacklog || task.dueDate !== col.date) {
    // From backlog → dated, or cross-column: assign new date, clear backlog flag
    task.dueDate     = col.date;
    task.isBacklog   = false;
    task.manualOrder = null;
  } else if (colEl) {
    // Same-column drop: assign manualOrder based on placeholder position in DOM
    const cardsEl  = colEl.querySelector('.col-cards');
    const newOrder = [...cardsEl.children]
      .map(el => {
        if (el === dragPlaceholder)             return draggedId;  // placeholder = new position
        if (el.id === 'card-' + draggedId)      return null;       // skip the original dragging element
        if (el.id && el.id.startsWith('card-')) return el.id.replace('card-', '');
        return null;
      })
      .filter(id => id !== null);

    newOrder.forEach((id, index) => {
      const t = tasks.find(t => t.id === id);
      if (t) t.manualOrder = index;
    });
  }

  draggedId = null;
  saveTasks();
  renderBoard();
  stampRefresh();
}

// Find the card element that the dragged card should be inserted before,
// based on cursor Y position. Non-important cards cannot go above important ones.
function getDragAfterElement(container, y, isImportantDragged, isScheduledDragged) {
  const allCards   = [...container.querySelectorAll('.card:not(.dragging)')];
  // Non-priority, non-scheduled cards may only insert among other non-priority, non-scheduled cards
  const candidates = (isImportantDragged || isScheduledDragged)
    ? allCards
    : allCards.filter(c => !c.classList.contains('important') && !c.classList.contains('scheduled'));

  return candidates.reduce((closest, child) => {
    const box    = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ─── Reset Board Order ──────────────────────────────────────────────────────── */
function openResetOrderModal(colId) {
  resettingColId = colId;
  show('reset-order-overlay');
}

function closeResetOrderModal() {
  resettingColId = null;
  hide('reset-order-overlay');
}

function confirmResetOrder() {
  if (!resettingColId) return;
  pushHistory();
  // Clear manualOrder only for tasks in this column
  tasks
    .filter(t => getColumnId(t) === resettingColId)
    .forEach(t => { t.manualOrder = null; });
  saveTasks();
  closeResetOrderModal();
  renderBoard();
}

/* ─── Links Field ────────────────────────────────────────────────────────────── */
function renderLinkInputs(links) {
  document.getElementById('f-links-list').innerHTML = '';
  const initial = links.length ? links : [''];
  initial.forEach(url => addLinkInput(url, false));
}

function addLinkInput(value = '', focus = false) {
  const list = document.getElementById('f-links-list');
  const row  = document.createElement('div');
  row.className = 'link-input-row';
  row.innerHTML = `
    <input type="text" class="link-input" placeholder="https://...">
    <button type="button" class="btn-link-remove" onclick="removeLinkInput(this)" aria-label="Remove link" tabindex="-1">✕</button>`;
  row.querySelector('input').value = value; // set value directly to avoid XSS
  list.appendChild(row);
  if (focus) row.querySelector('input').focus();
}

function removeLinkInput(btn) {
  const list = document.getElementById('f-links-list');
  const row  = btn.closest('.link-input-row');
  // Keep at least one row — just clear it instead of removing
  if (list.children.length > 1) {
    row.remove();
  } else {
    row.querySelector('input').value = '';
  }
}

// Collect, validate, and return non-empty http/https URLs
function collectLinks() {
  return [...document.querySelectorAll('#f-links-list .link-input')]
    .map(el => el.value.trim())
    .filter(url => /^https?:\/\/.+/.test(url));
}

/* ─── Modal – Add / Edit ─────────────────────────────────────────────────────── */
function openModal(date) {
  editingId = null;
  document.getElementById('modal-heading').textContent = 'New Task';
  document.getElementById('submit-btn').textContent    = 'Add Task';
  document.getElementById('task-form').reset();
  renderLinkInputs([]);
  // Board-specific: use provided date (may be '' for backlog). Global button: default to today.
  if (date !== undefined) {
    document.getElementById('f-date').value = date;
  } else {
    setDefaultDate();
  }
  const _n = new Date();
  document.getElementById('f-time').value =
    String(_n.getHours()).padStart(2, '0') + ':' + String(_n.getMinutes()).padStart(2, '0');
  show('modal-overlay');
  setTimeout(() => document.getElementById('f-title').focus(), 80);
}

function openEdit(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  editingId = taskId;
  document.getElementById('modal-heading').textContent = 'Edit Task';
  document.getElementById('submit-btn').textContent    = 'Save Changes';
  document.getElementById('f-title').value = task.title;
  document.getElementById('f-desc').value  = task.description || '';
  document.getElementById('f-date').value  = task.dueDate;
  document.getElementById('f-time').value  = task.dueTime || '';
  document.getElementById('f-tag').checked       = task.tag === 'Deliverables';
  document.getElementById('f-scheduled').checked  = !!task.isScheduled;
  document.getElementById('f-important').checked  = !!task.isImportant;
  renderLinkInputs(task.links || []);
  show('modal-overlay');
  setTimeout(() => document.getElementById('f-title').focus(), 80);
}

function closeModal() {
  hide('modal-overlay');
  editingId = null;
}

function handleOverlayClick(e) {
  if (e.target.id === 'modal-overlay') closeModal();
}

function setDefaultDate() {
  document.getElementById('f-date').value = todayStr();
}

function submitTask(e) {
  e.preventDefault();
  const title       = document.getElementById('f-title').value.trim();
  const desc        = document.getElementById('f-desc').value.trim();
  const date        = document.getElementById('f-date').value;
  const time        = document.getElementById('f-time').value;
  const tag         = document.getElementById('f-tag').checked ? 'Deliverables' : null;
  const isScheduled = document.getElementById('f-scheduled').checked;
  const isImportant = document.getElementById('f-important').checked;
  const links       = collectLinks();
  if (!title) return;

  pushHistory();
  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) Object.assign(task, { title, description: desc, dueDate: date, dueTime: time, tag, isImportant, isScheduled, links, isBacklog: !date });
  } else {
    tasks.push({
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      description: desc,
      dueDate:     date,
      dueTime:     time,
      tag,
      isImportant,
      isScheduled,
      links,
      isBacklog:   !date,
      createdAt:   new Date().toISOString()
    });
  }

  saveTasks();
  closeModal();
  renderBoard();
  stampRefresh();
}

/* ─── Delete ─────────────────────────────────────────────────────────────────── */
function openDelete(taskId) {
  deletingId = taskId;
  show('delete-overlay');
}

function closeDeleteModal() {
  deletingId = null;
  hide('delete-overlay');
}

function confirmDelete() {
  if (!deletingId) return;
  pushHistory();
  tasks = tasks.filter(t => t.id !== deletingId);
  saveTasks();
  closeDeleteModal();
  renderBoard();
}

/* ─── View Toggle ────────────────────────────────────────────────────────────── */
function setView(v) {
  currentView = v;
  document.getElementById('btn-kanban').classList.toggle('active', v === 'kanban');
  document.getElementById('btn-timeline').classList.toggle('active', v === 'timeline');
  syncMobileViewButtons();
  renderBoard();
  updateNavButtons();
}

/* ─── Live Clock ─────────────────────────────────────────────────────────────── */
function startClock() {
  const el = document.getElementById('live-clock');
  function tick() {
    const now  = new Date();
    const h24  = now.getHours();
    const h12  = h24 % 12 || 12;
    const mm   = String(now.getMinutes()).padStart(2, '0');
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const day  = now.toLocaleDateString('en-US', { weekday: 'short' });
    const mon  = now.toLocaleDateString('en-US', { month: 'long' });
    const date = now.getDate();
    if (el) el.textContent = `${day} ${mon} ${date}  ${h12}:${mm} ${ampm}`;
  }
  tick();
  setInterval(tick, 60000);
  setInterval(renderStaleIndicator, 30000);
}

/* ─── Export / Import ────────────────────────────────────────────────────────── */
function exportTasks() {
  const note = localStorage.getItem(NOTES_KEY) || '';
  if (!tasks.length && !note) { alert('Nothing to export.'); return; }
  const payload  = { tasks, notes: note };
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `panicboard-${date}.json`;
  const blob     = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importTasks(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);

      // Support both old format (plain array) and new format ({ tasks, notes })
      let importedTasks, importedNotes;
      if (Array.isArray(parsed)) {
        importedTasks = parsed;
        importedNotes = undefined;
      } else if (parsed && typeof parsed === 'object') {
        importedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        importedNotes = parsed.notes;
      } else {
        throw new Error('Invalid format');
      }

      const existingIds = new Set(tasks.map(t => t.id));
      const fresh = importedTasks.filter(t => t.id && t.title && !existingIds.has(t.id));
      tasks.push(...fresh);
      saveTasks();
      renderBoard();

      // Import notes if present, without overwriting if absent
      if (importedNotes !== undefined) {
        localStorage.setItem(NOTES_KEY, importedNotes);
        const ta = document.getElementById('notes-textarea');
        if (ta) ta.value = importedNotes;
      }

      const skipped = importedTasks.length - fresh.length;
      const msg = `Imported ${fresh.length} task${fresh.length !== 1 ? 's' : ''}.`
        + (skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : '');
      showToast(msg);
    } catch {
      showToast('Import failed — invalid file.', true);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

/* ─── Task Preview (read-only) ───────────────────────────────────────────────── */
let previewingId = null;

function openPreview(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  previewingId = taskId;

  // Populate modal heading with task title
  document.getElementById('preview-title').textContent = task.title;

  // Build read-only detail rows
  const rows = [];

  if (task.isImportant) {
    rows.push(`<div class="preview-badge">${ICON.star} Priority</div>`);
  }
  if (task.isScheduled) {
    rows.push(`<div class="preview-badge preview-badge--scheduled">${ICON.calendar} Scheduled</div>`);
  }

  if (task.description) {
    rows.push(`
      <div class="preview-field">
        <span class="preview-label">Description</span>
        <p class="preview-value">${escHtml(task.description)}</p>
      </div>`);
  }

  if (task.links?.length) {
    const linkItems = task.links
      .map(url => `<a class="preview-link" href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`)
      .join('');
    rows.push(`
      <div class="preview-field">
        <span class="preview-label">Links</span>
        <div class="preview-links">${linkItems}</div>
      </div>`);
  }

  const timeStr = task.dueTime ? ` · ${fmtTime12(task.dueTime)}` : '';
  rows.push(`
    <div class="preview-field">
      <span class="preview-label">Due</span>
      <p class="preview-value">${shortDate(task.dueDate)}${timeStr}</p>
    </div>`);

  // Tags: Scheduled (lavender) first, Deliverables (blue) second
  const previewPills = [];
  if (task.isImportant)            previewPills.push(`<span class="card-tag-pill pill-important">${ICON.star} Priority</span>`);
  if (task.isScheduled)             previewPills.push(`<span class="card-tag-pill pill-scheduled">${ICON.calendar} Scheduled</span>`);
  if (task.tag === 'Deliverables') previewPills.push(`<span class="card-tag-pill pill-deliverables">${ICON.docDown} Deliverables</span>`);
  if (previewPills.length) {
    rows.push(`<div class="preview-field">${previewPills.join('')}</div>`);
  }

  document.getElementById('preview-body').innerHTML = rows.join('');
  show('preview-overlay');
}

function closePreview() {
  previewingId = null;
  hide('preview-overlay');
}

// Close preview and open edit modal for the same task
function previewEdit() {
  const id = previewingId;
  closePreview();
  openEdit(id);
}

// Close preview then show the existing delete confirmation for the same task
function previewDelete() {
  const id = previewingId;
  closePreview();
  openDelete(id);
}

/* ─── Notes Panel ────────────────────────────────────────────────────────────── */
function loadNote() {
  const saved = localStorage.getItem(NOTES_KEY) || '';
  const ta = document.getElementById('notes-textarea');
  if (ta) ta.value = saved;
}

// Persist note content on every keystroke
function saveNote() {
  const ta = document.getElementById('notes-textarea');
  if (ta) localStorage.setItem(NOTES_KEY, ta.value);
}

function toggleNotesPanel() {
  const panel = document.getElementById('notes-panel');
  const btn   = document.getElementById('btn-notes');
  const open  = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
}

function closeNotesPanel() {
  const panel = document.getElementById('notes-panel');
  const btn   = document.getElementById('btn-notes');
  panel.classList.remove('open');
  btn.classList.remove('active');
}

function openClearNoteModal()  { show('clear-note-overlay'); }
function closeClearNoteModal() { hide('clear-note-overlay'); }

function confirmClearNote() {
  // Wipe note from storage and reset textarea
  localStorage.removeItem(NOTES_KEY);
  const ta = document.getElementById('notes-textarea');
  if (ta) ta.value = '';
  closeClearNoteModal();
}

/* ─── Clear All Data ─────────────────────────────────────────────────────────── */
function openClearModal() {
  show('clear-overlay');
}

function closeClearModal() {
  hide('clear-overlay');
}

function confirmClear() {
  // Clear persisted task data from localStorage
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('panicboard_pending_notif');

  // Reset in-memory application state to initial empty state
  tasks        = [];
  historyStack = [];
  editingId    = null;
  deletingId   = null;

  closeClearModal();
  renderBoard();
  showToast('All data cleared.');
}

/* ─── Toast ──────────────────────────────────────────────────────────────────── */
// type: '' | 'error' | 'overdue'  (also accepts legacy boolean true → 'error')
function showToast(msg, type = '') {
  if (type === true) type = 'error';
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className   = 'toast' + (type ? ` toast-${type}` : '');
  toast.classList.add('toast-show');
  clearTimeout(toast._timer);
  // overdue notifications linger a bit longer
  toast._timer = setTimeout(() => toast.classList.remove('toast-show'), type === 'overdue' ? 5000 : 3000);
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Keyboard Shortcuts ─────────────────────────────────────────────────────── */
document.addEventListener('click', e => {
  const panel = document.getElementById('notes-panel');
  if (!panel?.classList.contains('open')) return;
  if (e.target.closest('#notes-panel') || e.target.closest('#btn-notes') || e.target.closest('#mobile-menu') || e.target.closest('.btn-mobile-menu')) return;
  closeNotesPanel();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); closePreview(); closeClearNoteModal(); closeResetOrderModal(); closeNotesPanel(); closeMobileMenu(); }
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
    const tag = document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') openModal();
  }
  if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
});

/* ─── Board Horizontal Navigation ───────────────────────────────────────────── */

// Scroll the board by one column width in the given direction (-1 left, +1 right)
function scrollBoard(dir) {
  const app = document.getElementById('app');
  const colWidth = 280 + 16; // column width + gap
  app.scrollBy({ left: dir * colWidth, behavior: 'smooth' });
  // Re-check arrow visibility after animation settles
  setTimeout(updateNavButtons, 350);
}

// Show/hide the nav arrows based on current scroll position and overflow state
function updateNavButtons() {
  const app   = document.getElementById('app');
  const left  = document.getElementById('board-nav-left');
  const right = document.getElementById('board-nav-right');
  if (!left || !right) return;

  // Hide both arrows when not in kanban view or no overflow
  if (currentView !== 'kanban' || app.scrollWidth <= app.clientWidth + 1) {
    left.classList.add('hidden');
    right.classList.add('hidden');
    return;
  }

  left.classList.toggle('hidden',  app.scrollLeft < 4);
  right.classList.toggle('hidden', app.scrollLeft >= app.scrollWidth - app.clientWidth - 4);
}

// Drag-to-scroll: mouse (desktop) + touch (mobile) on the #app container
function initBoardDragScroll() {
  const app = document.getElementById('app');
  let isDown = false, startX, startScrollLeft;

  app.addEventListener('mousedown', e => {
    // Don't hijack drags on cards or button clicks
    if (e.target.closest('[draggable="true"]') || e.target.closest('button')) return;
    isDown = true;
    startX = e.pageX - app.offsetLeft;
    startScrollLeft = app.scrollLeft;
    app.classList.add('drag-scrolling');
  });

  app.addEventListener('mouseleave', () => { isDown = false; app.classList.remove('drag-scrolling'); });
  app.addEventListener('mouseup',    () => { isDown = false; app.classList.remove('drag-scrolling'); });

  app.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - app.offsetLeft;
    app.scrollLeft = startScrollLeft - (x - startX) * 1.2;
    updateNavButtons();
  });

  // Touch support (passive listeners — no preventDefault needed for scroll)
  let touchStartX, touchStartScrollLeft;
  app.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].pageX;
    touchStartScrollLeft = app.scrollLeft;
  }, { passive: true });

  app.addEventListener('touchmove', e => {
    app.scrollLeft = touchStartScrollLeft - (e.touches[0].pageX - touchStartX);
    updateNavButtons();
  }, { passive: true });

  // Keep arrows in sync when user scrolls manually (trackpad, etc.)
  app.addEventListener('scroll', updateNavButtons, { passive: true });

  // Re-check on window resize in case overflow state changes
  window.addEventListener('resize', updateNavButtons);
}

/* ─── Mobile Menu ────────────────────────────────────────────────────────────── */
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn  = document.getElementById('btn-mobile-menu');
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
  syncMobileViewButtons();
  syncMobileThemeIcon();
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn  = document.getElementById('btn-mobile-menu');
  menu.classList.remove('open');
  btn.classList.remove('open');
}

function syncMobileViewButtons() {
  const kb = document.getElementById('btn-kanban-mobile');
  const tl = document.getElementById('btn-timeline-mobile');
  if (kb) kb.classList.toggle('active', currentView === 'kanban');
  if (tl) tl.classList.toggle('active', currentView === 'timeline');
}

function syncMobileThemeIcon() {
  const el = document.getElementById('theme-icon-mobile');
  if (!el) return;
  el.innerHTML = document.body.dataset.theme === 'dark'
    ? SUN_SVG + ' Toggle Theme'
    : MOON_SVG + ' Toggle Theme';
}

/* ─── Go ─────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
