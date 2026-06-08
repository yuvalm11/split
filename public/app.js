const MAX_COLUMNS = 6;

let state = { columns: [] };

const dashboard = document.getElementById('dashboard');
const addColumnBtn = document.getElementById('add-column-btn');
const unhideColumnsBtn = document.getElementById('unhide-columns-btn');
const unhideDropdown = document.getElementById('unhide-dropdown');
const modalOverlay = document.getElementById('modal-overlay');
const addColumnForm = document.getElementById('add-column-form');
const cancelColumnBtn = document.getElementById('cancel-column-btn');
const columnNameInput = document.getElementById('column-name');
const columnColorInput = document.getElementById('column-color');
const columnColorHexInput = document.getElementById('column-color-hex');

function generateId() {
  return crypto.randomUUID();
}

function visibleColumns() {
  return state.columns.filter((c) => !c.hidden);
}

function hiddenColumns() {
  return state.columns.filter((c) => c.hidden);
}

function normalizeState(data) {
  data.columns.forEach((col) => {
    if (col.hidden === undefined) col.hidden = false;
    col.updates.forEach((u) => {
      if (u.running === undefined) u.running = false;
      if (u.done) u.running = false;
    });
  });
  return data;
}

async function loadData() {
  const res = await fetch('/api/data');
  state = normalizeState(await res.json());
  render();
}

async function saveData() {
  await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

function openModal() {
  columnNameInput.value = '';
  columnColorInput.value = '#4f8cff';
  columnColorHexInput.value = '#4f8cff';
  modalOverlay.classList.remove('hidden');
  columnNameInput.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
}

function syncColorInputs(from) {
  if (from === 'picker') {
    columnColorHexInput.value = columnColorInput.value;
  } else {
    const hex = columnColorHexInput.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      columnColorInput.value = hex;
    }
  }
}

function renderUnhideDropdown() {
  const hidden = hiddenColumns();
  const atLimit = visibleColumns().length >= MAX_COLUMNS;
  unhideColumnsBtn.disabled = hidden.length === 0;

  if (hidden.length === 0) {
    unhideDropdown.innerHTML = '<div class="dropdown-empty">No hidden columns</div>';
    return;
  }

  const limitNote = atLimit
    ? '<div class="dropdown-empty">Hide a column first (max 6 visible)</div>'
    : '';

  unhideDropdown.innerHTML =
    limitNote +
    hidden
      .map(
        (col) => `
        <button type="button" class="dropdown-item" data-action="unhide-column" data-id="${col.id}" ${atLimit ? 'disabled' : ''}>
          <span class="color-dot" style="background: ${col.color}"></span>
          ${escapeHtml(col.name)}
        </button>
      `
      )
      .join('');

  unhideDropdown.querySelectorAll('[data-action="unhide-column"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      unhideColumn(btn.dataset.id);
      closeUnhideDropdown();
    });
  });
}

function openUnhideDropdown() {
  renderUnhideDropdown();
  unhideDropdown.classList.remove('hidden');
}

function closeUnhideDropdown() {
  unhideDropdown.classList.add('hidden');
}

function render() {
  const visible = visibleColumns();
  addColumnBtn.disabled = visible.length >= MAX_COLUMNS;
  renderUnhideDropdown();

  if (visible.length === 0) {
    const msg = hiddenColumns().length
      ? 'All columns are hidden — use "Unhide Columns" to restore one.'
      : 'No tasks yet — click "Add Column" to get started.';
    dashboard.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  dashboard.innerHTML = visible.map((col) => renderColumn(col)).join('');
  bindEvents();
}

function renderColumn(col) {
  const active = col.updates
    .filter((u) => !u.done)
    .sort((a, b) => (b.running ? 1 : 0) - (a.running ? 1 : 0));
  const done = col.updates.filter((u) => u.done);

  const activeHtml = active.length
    ? active.map((u) => renderUpdate(col.id, u, false)).join('')
    : '<div class="update" style="opacity:0.5;font-style:italic">No active updates</div>';

  const doneHtml = done.length
    ? `<div class="done-label">Completed (${done.length})</div>` +
      done.map((u) => renderUpdate(col.id, u, true)).join('')
    : '';

  return `
    <div class="column" data-id="${col.id}" style="--column-color: ${col.color}">
      <div class="column-header">
        <div class="column-title">
          <span class="color-dot" data-action="copy-color" data-color="${col.color}" style="background: ${col.color}" title="Click to copy ${col.color}"></span>
          ${escapeHtml(col.name)}
        </div>
        <div class="column-header-actions">
          <button class="column-hide" data-action="hide-column" data-id="${col.id}" title="Hide column">&#128065;</button>
          <button class="column-delete" data-action="delete-column" data-id="${col.id}" title="Delete column">&times;</button>
        </div>
      </div>
      <div class="updates-area">
        <div class="active-updates">${activeHtml}</div>
        <div class="done-updates">${doneHtml}</div>
      </div>
      <form class="add-update" data-id="${col.id}">
        <input type="text" placeholder="Add an update..." required maxlength="500">
        <button type="submit" class="btn btn-primary btn-small">Add</button>
      </form>
    </div>
  `;
}

function renderUpdate(colId, update, isDone) {
  const runningDots = update.running
    ? '<span class="running-dots" aria-label="Running"><span>.</span><span>.</span><span>.</span></span>'
    : '';
  const runBtn = !isDone
    ? `<button type="button" class="run-btn ${update.running ? 'active' : ''}" data-action="toggle-running" data-col="${colId}" data-id="${update.id}" title="${update.running ? 'Stop running' : 'Mark as running'}">▶</button>`
    : '';

  return `
    <div class="update ${isDone ? 'done' : ''} ${update.running ? 'running' : ''}" data-update-id="${update.id}">
      <input type="checkbox" data-action="toggle-update" data-col="${colId}" data-id="${update.id}" ${update.done ? 'checked' : ''}>
      <span class="update-text">${escapeHtml(update.text)}${runningDots}</span>
      ${runBtn}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function copyColor(hex, dot) {
  try {
    await navigator.clipboard.writeText(hex);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = hex;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  dot.classList.add('copied');
  dot.title = `Copied ${hex}`;
  setTimeout(() => {
    dot.classList.remove('copied');
    dot.title = `Click to copy ${hex}`;
  }, 1200);
}

function bindEvents() {
  dashboard.querySelectorAll('[data-action="copy-color"]').forEach((dot) => {
    dot.addEventListener('click', () => copyColor(dot.dataset.color, dot));
  });

  dashboard.querySelectorAll('[data-action="hide-column"]').forEach((btn) => {
    btn.addEventListener('click', () => hideColumn(btn.dataset.id));
  });

  dashboard.querySelectorAll('[data-action="delete-column"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteColumn(btn.dataset.id));
  });

  dashboard.querySelectorAll('[data-action="toggle-update"]').forEach((cb) => {
    cb.addEventListener('change', () => toggleUpdate(cb.dataset.col, cb.dataset.id, cb.checked));
  });

  dashboard.querySelectorAll('[data-action="toggle-running"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleRunning(btn.dataset.col, btn.dataset.id));
  });

  dashboard.querySelectorAll('.add-update').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      addUpdate(form.dataset.id, input.value.trim());
      input.value = '';
    });
  });
}

async function addColumn(name, color) {
  state.columns.push({
    id: generateId(),
    name,
    color,
    hidden: false,
    updates: [],
  });
  await saveData();
  render();
}

async function hideColumn(id) {
  const col = state.columns.find((c) => c.id === id);
  if (!col) return;
  col.hidden = true;
  await saveData();
  render();
}

async function unhideColumn(id) {
  if (visibleColumns().length >= MAX_COLUMNS) return;
  const col = state.columns.find((c) => c.id === id);
  if (!col) return;
  col.hidden = false;
  await saveData();
  render();
}

async function deleteColumn(id) {
  const col = state.columns.find((c) => c.id === id);
  if (!col) return;
  if (!confirm(`Delete "${col.name}" and all its updates?`)) return;
  state.columns = state.columns.filter((c) => c.id !== id);
  await saveData();
  render();
}

async function addUpdate(colId, text) {
  if (!text) return;
  const col = state.columns.find((c) => c.id === colId);
  if (!col) return;
  col.updates.unshift({
    id: generateId(),
    text,
    done: false,
    running: false,
    createdAt: new Date().toISOString(),
  });
  await saveData();
  render();
}

async function toggleUpdate(colId, updateId, done) {
  const col = state.columns.find((c) => c.id === colId);
  if (!col) return;
  const update = col.updates.find((u) => u.id === updateId);
  if (!update) return;
  update.done = done;
  if (done) update.running = false;
  await saveData();
  render();
}

async function toggleRunning(colId, updateId) {
  const col = state.columns.find((c) => c.id === colId);
  if (!col) return;
  const update = col.updates.find((u) => u.id === updateId);
  if (!update || update.done) return;
  update.running = !update.running;
  await saveData();
  render();
}

addColumnBtn.addEventListener('click', openModal);
cancelColumnBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

columnColorInput.addEventListener('input', () => syncColorInputs('picker'));
columnColorHexInput.addEventListener('input', () => syncColorInputs('hex'));

addColumnForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = columnNameInput.value.trim();
  const color = columnColorHexInput.value;
  if (!name || !/^#[0-9A-Fa-f]{6}$/.test(color)) return;
  if (visibleColumns().length >= MAX_COLUMNS) return;
  closeModal();
  await addColumn(name, color);
});

unhideColumnsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (unhideDropdown.classList.contains('hidden')) {
    openUnhideDropdown();
  } else {
    closeUnhideDropdown();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.unhide-wrapper')) {
    closeUnhideDropdown();
  }
});

loadData();
