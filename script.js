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

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
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
  const time = task.dueTime || '23:59';
  return new Date(`${task.dueDate}T${time}:00`).getTime();
}

function calculateTaskState(task) {
  const now  = Date.now();
  const dead = getDeadlineMs(task);
  const diff = dead - now;

  if (diff < 0) {
    const abs = -diff;
    const d   = Math.floor(abs / 864e5);
    const h   = Math.floor(abs / 36e5);
    const m   = Math.floor(abs / 6e4);
    const label = d >= 1 ? `⚠️ ${d}d overdue`
                : h >= 1 ? `⚠️ ${h}h overdue`
                :          `⚠️ ${m}m overdue`;
    return { label, cls: 'overdue', pulsing: false };
  }

  const secs  = diff / 1000;
  const mins  = diff / 6e4;
  const hours = diff / 36e5;
  const days  = diff / 864e5;

  if (secs < 60)  return { label: `🔥 ${Math.ceil(secs)}s left`,  cls: 'critical', pulsing: true  };
  if (hours < 1)  return { label: `🔥 ${Math.ceil(mins)}m left`,  cls: 'critical', pulsing: true  };
  if (hours < 24) return {
    label: `🔥 ${Math.floor(hours)}h ${String(Math.ceil(mins % 60)).padStart(2, '0')}m left`,
    cls: 'critical', pulsing: false
  };
  if (days < 3)   return { label: `⏰ ${Math.ceil(days)}d left`,  cls: 'warning',  pulsing: false };
  return               { label: `✓ ${Math.ceil(days)}d left`,    cls: 'safe',     pulsing: false };
}

/* ─── Column Grouping ───────────────────────────────────────────────────────── */
function getColumnId(task) {
  return getDeadlineMs(task) < Date.now() ? 'overdue' : task.dueDate;
}

function groupTasksByDate() {
  const t   = todayStr();
  const tom = addDays(t, 1);
  const now = Date.now();
  const cols = [];

  const hasOverdue = tasks.some(task => getDeadlineMs(task) < now);
  if (hasOverdue) {
    cols.push({ id: 'overdue', label: 'Overdue', sub: 'Past due', date: null, type: 'overdue' });
  }

  const uniqueDates = [...new Set(
    tasks
      .filter(task => getDeadlineMs(task) >= now)
      .map(task => task.dueDate)
  )].sort();

  for (const ds of uniqueDates) {
    const d = new Date(ds + 'T12:00:00');
    let label, type;

    if (ds === t)        { label = 'Today';    type = 'today';    }
    else if (ds === tom) { label = 'Tomorrow'; type = 'tomorrow'; }
    else                 { label = d.toLocaleDateString('en-US', { weekday: 'short' }); type = 'future'; }

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
      // 2. Manual order (if set on both)
      const aHas = a.manualOrder != null, bHas = b.manualOrder != null;
      if (aHas && bHas) return a.manualOrder - b.manualOrder;
      if (aHas) return -1;
      if (bHas) return 1;
      // 3. Fallback to deadline
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
    const afterEl        = getDragAfterElement(cardsEl, e.clientY, draggedTask?.isImportant);
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

  const icon       = col.type === 'overdue' ? '🔴 ' : col.type === 'today' ? '📌 ' : '';
  const hasManual  = colTasks.some(t => t.manualOrder != null);
  const resetBtn   = hasManual
    ? `<button class="col-reset-btn" onclick="event.stopPropagation(); openResetOrderModal('${col.id}')" title="Reset to time order">↺</button>`
    : '';
  el.innerHTML = `
    <div class="col-header">
      <div class="col-title-group">
        <span class="col-label">${icon}${col.label}</span>
        <span class="col-sublabel">${col.sub}</span>
      </div>
      <div class="col-actions">
        <span class="col-badge">${colTasks.length}</span>
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
      // 2. Manual order (if set on both)
      const aHas = a.manualOrder != null, bHas = b.manualOrder != null;
      if (aHas && bHas) return a.manualOrder - b.manualOrder;
      if (aHas) return -1;
      if (bHas) return 1;
      // 3. Fallback to deadline
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
  const queueCls      = task.isQueue ? ' tag-queue' : '';
  const tagCls        = task.tag === 'Deliverables' ? ' tag-deliverables' : '';
  const importantCls  = task.isImportant ? ' important' : '';
  const descPart = task.description
    ? `<div class="card-desc">${escHtml(task.description)}</div>` : '';
  const timePart   = task.dueTime ? ` · ${fmtTime12(task.dueTime)}` : '';
  // Tags: Queue (cyan) first, Deliverables (blue) second
  const pillParts = [];
  if (task.isQueue)              pillParts.push(`<span class="card-tag-pill pill-queue">Queue</span>`);
  if (task.tag === 'Deliverables') pillParts.push(`<span class="card-tag-pill pill-deliverables">Deliverables</span>`);
  const tagPart = pillParts.length ? `<div class="card-tag">${pillParts.join('')}</div>` : '';

  return `
    <div class="card ${state.cls}${pulsCls}${queueCls}${tagCls}${importantCls}"
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
          <span class="card-created">${shortDate(task.dueDate)}${timePart}</span>
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
  if (!draggedId || !col.date) return;
  const task = tasks.find(t => t.id === draggedId);
  if (!task) return;

  pushHistory();

  if (task.dueDate !== col.date) {
    // Cross-column drop: move to new date, clear manual order
    task.dueDate      = col.date;
    task.manualOrder  = null;
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
function getDragAfterElement(container, y, isImportantDragged) {
  const allCards   = [...container.querySelectorAll('.card:not(.dragging)')];
  // Non-priority cards may only insert among other non-priority cards
  const candidates = isImportantDragged
    ? allCards
    : allCards.filter(c => !c.classList.contains('important'));

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
function openModal() {
  editingId = null;
  document.getElementById('modal-heading').textContent = 'New Task';
  document.getElementById('submit-btn').textContent    = 'Add Task';
  document.getElementById('task-form').reset();
  renderLinkInputs([]);
  setDefaultDate();
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
  document.getElementById('f-queue').checked     = !!task.isQueue;
  document.getElementById('f-important').checked = !!task.isImportant;
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
  const isQueue     = document.getElementById('f-queue').checked;
  const isImportant = document.getElementById('f-important').checked;
  const links       = collectLinks();
  if (!title || !date) return;

  pushHistory();
  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) Object.assign(task, { title, description: desc, dueDate: date, dueTime: time, tag, isImportant, isQueue, links });
  } else {
    tasks.push({
      id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      description: desc,
      dueDate:     date,
      dueTime:     time,
      tag,
      isImportant,
      isQueue,
      links,
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
  if (!tasks.length) { alert('No tasks to export.'); return; }
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `panicboard-${date}.json`;
  const blob     = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
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
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const existingIds = new Set(tasks.map(t => t.id));
      const fresh = imported.filter(t => t.id && t.title && t.dueDate && !existingIds.has(t.id));
      tasks.push(...fresh);
      saveTasks();
      renderBoard();

      const skipped = imported.length - fresh.length;
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
    rows.push(`<div class="preview-badge">🔥 Priority</div>`);
  }
  if (task.isQueue) {
    rows.push(`<div class="preview-badge preview-badge--queue">Queue</div>`);
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

  // Tags: Queue (cyan) first, Deliverables (blue) second
  const previewPills = [];
  if (task.isQueue)              previewPills.push(`<span class="card-tag-pill pill-queue">Queue</span>`);
  if (task.tag === 'Deliverables') previewPills.push(`<span class="card-tag-pill pill-deliverables">Deliverables</span>`);
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); closePreview(); closeClearNoteModal(); closeResetOrderModal(); }
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

/* ─── Go ─────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
