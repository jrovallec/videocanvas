'use strict';

/* ── STATE ─────────────────────────────── */
const state = {
  cards: [], labels: [], tags: [],
  zoom: 1, panX: 0, panY: 0,
  selectMode: false,
  selectedIds: new Set(),
  contextCardId: null,
  tagModalCardId: null,
  renameCardId: null,
  tagModalMulti: false,
  activeTagFilter: null,
  searchQuery: '',
};

const MIN_ZOOM = 0.1, MAX_ZOOM = 3, ZOOM_STEP = 0.1;
let fileMap = {};
let _masonryBatch = null;
let _isPanning = false, _panStartX = 0, _panStartY = 0;

/* ── DOM ───────────────────────────────── */
const viewport      = document.getElementById('viewport');
const canvas        = document.getElementById('canvas');
const emptyState    = document.getElementById('empty-state');
const folderInput   = document.getElementById('folder-input');
const zoomLabel     = document.getElementById('zoom-label');
const tagFilter     = document.getElementById('tag-filter');
const searchInput   = document.getElementById('search-input');
const contextMenu   = document.getElementById('context-menu');
const modalRename   = document.getElementById('modal-rename');
const renameInput   = document.getElementById('rename-input');
const modalRenameM  = document.getElementById('modal-rename-multi');
const modalTag      = document.getElementById('modal-tag');
const tagPicker     = document.getElementById('tag-picker');
const newTagInput   = document.getElementById('new-tag-input');
const newTagColor   = document.getElementById('new-tag-color');
const modalSort     = document.getElementById('modal-sort');
const playerOverlay = document.getElementById('player-overlay');
const playerVideo   = document.getElementById('player-video');
const playerTitle   = document.getElementById('player-title');
const toastCont     = document.getElementById('toast-container');
const selBar        = document.getElementById('selection-bar');
const selCount      = document.getElementById('selection-count');

/* ── INIT ──────────────────────────────── */
(function init() {
  loadFromStorage();
  applyTheme();
  bindEvents();
  renderTagFilter();
  applyTransform();
  updateEmptyState();
  state.cards.forEach(c => renderCard(c, null));
  state.labels.forEach(l => renderLabel(l));
})();

/* ── EVENTS ────────────────────────────── */
function bindEvents() {
  document.getElementById('btn-load-folder').onclick   = () => folderInput.click();
  document.getElementById('btn-load-folder-2').onclick = () => folderInput.click();
  folderInput.onchange = handleFolderInput;

  document.getElementById('btn-zoom-in').onclick    = () => adjustZoom(ZOOM_STEP);
  document.getElementById('btn-zoom-out').onclick   = () => adjustZoom(-ZOOM_STEP);
  document.getElementById('btn-reset-view').onclick = resetView;
  viewport.addEventListener('wheel', onWheel, { passive: false });

  // PAN — listen on viewport, stop propagation in cards/labels
  viewport.addEventListener('mousedown', onPanDown);
  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup', onPanUp);

  document.getElementById('btn-toggle-theme').onclick = toggleTheme;
  document.getElementById('btn-save').onclick   = saveToStorage;
  document.getElementById('btn-clear').onclick  = clearCanvas;
  document.getElementById('btn-export-bat').onclick = exportBat;
  document.getElementById('btn-select-mode').onclick = toggleSelectMode;
  document.getElementById('btn-add-label').onclick   = addLabelToCenter;
  document.getElementById('btn-sort').onclick = () => openModal(modalSort);
  document.getElementById('sort-cancel').onclick  = () => closeModal(modalSort);
  document.getElementById('sort-confirm').onclick = confirmSort;

  searchInput.oninput = () => { state.searchQuery = searchInput.value.trim().toLowerCase(); filterCards(); };

  document.addEventListener('click', e => { if (!contextMenu.contains(e.target)) hideContextMenu(); });
  contextMenu.addEventListener('click', onContextMenuAction);

  document.getElementById('rename-cancel').onclick  = () => closeModal(modalRename);
  document.getElementById('rename-confirm').onclick = confirmRename;
  renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmRename(); });

  document.getElementById('rename-multi-cancel').onclick  = () => closeModal(modalRenameM);
  document.getElementById('rename-multi-confirm').onclick = confirmRenameMulti;
  document.getElementById('rename-pattern').addEventListener('input', updateRenamePreview);

  // Token buttons insert at cursor position
  document.querySelectorAll('.token-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('rename-pattern');
      const token = btn.dataset.token;
      const start = input.selectionStart, end = input.selectionEnd;
      input.value = input.value.slice(0, start) + token + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + token.length;
      input.focus();
      updateRenamePreview();
    });
  });

  document.getElementById('tag-cancel').onclick  = () => closeModal(modalTag);
  document.getElementById('tag-confirm').onclick = confirmTags;
  document.getElementById('new-tag-confirm').onclick = addNewTag;
  newTagInput.addEventListener('keydown', e => { if (e.key === 'Enter') addNewTag(); });

  document.getElementById('btn-sel-rename').onclick = openRenameMultiModal;
  document.getElementById('btn-sel-tag').onclick    = () => { state.tagModalMulti = true; state.tagModalCardId = null; renderTagPicker(); openModal(modalTag); };
  document.getElementById('btn-sel-sort').onclick   = () => openModal(modalSort);
  document.getElementById('btn-sel-clear').onclick  = clearSelection;

  // Player close
  document.getElementById('player-close').onclick = closePlayer;
  playerOverlay.addEventListener('mousedown', e => { if (e.target === playerOverlay) closePlayer(); });

  // Modal overlays close on background click
  [modalRename, modalRenameM, modalTag, modalSort].forEach(modal => {
    modal.addEventListener('mousedown', e => { if (e.target === modal) closeModal(modal); });
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') return;
    if (e.key === 'Escape') {
      closePlayer();
      closeModal(modalRename); closeModal(modalRenameM);
      closeModal(modalTag); closeModal(modalSort);
      hideContextMenu();
      if (state.selectMode) toggleSelectMode();
    }
    if ((e.ctrlKey||e.metaKey) && e.key === 's') { e.preventDefault(); saveToStorage(); }
    if ((e.ctrlKey||e.metaKey) && e.key === '0') { e.preventDefault(); resetView(); }
    if (e.key === 's' && !e.ctrlKey && !e.metaKey) toggleSelectMode();
    if (e.key === 'l' || e.key === 'L') addLabelToCenter();
    if ((e.ctrlKey||e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll(); }
  });
}

/* ── PAN ───────────────────────────────── */
function onPanDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  if (e.button === 1) e.preventDefault();
  if (e.button === 0 && state.selectMode) return;
  _isPanning = true;
  _panStartX = e.clientX - state.panX;
  _panStartY = e.clientY - state.panY;
  viewport.classList.add('panning');
}
function onPanMove(e) {
  if (!_isPanning) return;
  state.panX = e.clientX - _panStartX;
  state.panY = e.clientY - _panStartY;
  applyTransform();
}
function onPanUp() {
  _isPanning = false;
  viewport.classList.remove('panning');
}
function stopPan() { _isPanning = false; viewport.classList.remove('panning'); }

/* ── FOLDER LOADING ────────────────────── */
function handleFolderInput(e) {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!files.length) { toast('No se encontraron videos ni imágenes', 'error'); return; }

  const GAP = 16;
  const COLS = Math.max(2, Math.min(14, Math.round(Math.sqrt(files.length * 1.3))));
  const COL_W = 260 + GAP;
  const startX = (-state.panX / state.zoom) + (viewport.clientWidth  / 2 / state.zoom);
  const startY = (-state.panY / state.zoom) + (viewport.clientHeight / 2 / state.zoom) - 200;
  const colH = new Array(COLS).fill(0);
  const batchCards = [];

  _masonryBatch = { cards: batchCards, total: files.length, loaded: 0, startX, startY };

  files.forEach(file => {
    const col = colH.indexOf(Math.min(...colH));
    const card = {
      id: genId(), name: cleanName(file.name), tags: [],
      x: Math.round(startX - (COLS * COL_W / 2) + col * COL_W),
      y: Math.round(startY + colH[col]),
      duration: null, _ratio: null, _size: file.size,
    };
    colH[col] += Math.round(260 / 0.5625) + 72 + GAP;
    state.cards.push(card);
    batchCards.push(card);
    fileMap[card.id] = file;
    renderCard(card, file);
  });

  updateEmptyState();
  toast(`${files.length} archivo${files.length > 1 ? 's' : ''} cargado${files.length > 1 ? 's' : ''}`, 'success');
  folderInput.value = '';
}

/* ── CARD RENDER ───────────────────────── */
function renderCard(card, file) {
  const old = document.getElementById('card-' + card.id);
  if (old) old.remove();

  const el = document.createElement('div');
  el.className = 'video-card' + (state.selectedIds.has(card.id) ? ' selected' : '');
  el.id = 'card-' + card.id;
  el.style.left = card.x + 'px';
  el.style.top  = card.y + 'px';

  el.innerHTML = `
    <div class="card-handle">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg>
    </div>
    <div class="card-checkbox">
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="card-thumb">
      <div class="thumb-placeholder">
        <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M10 8l5 3-5 3V8z" fill="currentColor"/></svg>
      </div>
      <div class="play-btn">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="rgba(0,0,0,.5)"/><path d="M10 8l6 4-6 4V8z" fill="white"/></svg>
      </div>
      <span class="duration-badge" id="dur-${card.id}">${card.duration ? formatDuration(card.duration) : ''}</span>
    </div>
    <div class="card-body">
      <div class="card-title" id="title-${card.id}" title="${escHtml(card.name)}">${escHtml(card.name)}</div>
      <div class="card-meta">${card._size ? formatSize(card._size) : ''}</div>
      <div class="card-tags" id="tags-${card.id}"></div>
    </div>`;

  canvas.appendChild(el);
  renderCardTags(card);
  if (file) loadThumbnail(card, file, el);

  // Checkbox
  el.querySelector('.card-checkbox').addEventListener('mousedown', e => { e.stopPropagation(); });
  el.querySelector('.card-checkbox').addEventListener('click', e => { e.stopPropagation(); toggleCardSelect(card.id); });

  // Card drag / select — stop propagation so pan doesn't fire
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    stopPan();
    e.stopPropagation();
    if (e.target.closest('.card-checkbox')) return;
    if (e.target.closest('.card-thumb')) return; // thumb has its own handler
    if (e.target.closest('.card-title') && !state.selectMode) return;
    if (state.selectMode) {
      if (state.selectedIds.has(card.id)) {
        // Start group drag, but deselect on click (no movement)
        const sx = (e.clientX - state.panX) / state.zoom;
        const sy = (e.clientY - state.panY) / state.zoom;
        let moved = false;
        startGroupDrag(e);
        function up(ev) {
          window.removeEventListener('mouseup', up);
          const dx = Math.abs((ev.clientX - state.panX) / state.zoom - sx);
          const dy = Math.abs((ev.clientY - state.panY) / state.zoom - sy);
          if (dx <= 4 && dy <= 4) toggleCardSelect(card.id); // click = deselect
        }
        window.addEventListener('mouseup', up);
      } else {
        toggleCardSelect(card.id);
      }
      return;
    }
    startCardDrag(e, card, el);
  });

  // Click thumb → open player
  // Click thumb → open player or select
  const thumb = el.querySelector('.card-thumb');
  thumb.addEventListener('mousedown', e => { e.stopPropagation(); stopPan(); });
  thumb.addEventListener('click', e => {
    e.stopPropagation();
    if (state.selectMode) { toggleCardSelect(card.id); return; }
    openPlayer(card);
  });

  el.querySelector('.card-title').addEventListener('dblclick', () => openRenameModal(card.id));
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, card.id); });

  applyCardVisibility(card, el);
}

/* ── THUMBNAIL ─────────────────────────── */
function loadThumbnail(card, file, el) {
  if (file.type.startsWith('image/')) {
    const thumbArea = el.querySelector('.card-thumb');
    const placeholder = thumbArea.querySelector('.thumb-placeholder');
    const url = URL.createObjectURL(file);
    const tmpImg = new Image();
    tmpImg.onload = () => {
      card._ratio = tmpImg.naturalWidth / tmpImg.naturalHeight;
      applyCardWidth(el, card._ratio);
      const img = document.createElement('img');
      img.className = 'thumb-img'; img.src = url; img.alt = ''; img.draggable = false;
      placeholder.style.display = 'none';
      thumbArea.insertBefore(img, thumbArea.querySelector('.play-btn'));
      thumbArea.querySelector('.play-btn').style.display = 'none';
      const durEl = document.getElementById('dur-' + card.id);
      if (durEl) durEl.style.display = 'none';
      batchLoaded();
    };
    tmpImg.src = url;
    return;
  }

  const thumbArea = el.querySelector('.card-thumb');
  const placeholder = thumbArea.querySelector('.thumb-placeholder');
  const vid = document.createElement('video');
  vid.src = URL.createObjectURL(file);
  vid.muted = true; vid.preload = 'metadata'; vid.playsInline = true;

  vid.addEventListener('loadedmetadata', () => {
    card.duration = vid.duration;
    const durEl = document.getElementById('dur-' + card.id);
    if (durEl) durEl.textContent = formatDuration(vid.duration);
    if (vid.videoWidth && vid.videoHeight) {
      card._ratio = vid.videoWidth / vid.videoHeight;
      applyCardWidth(el, card._ratio);
    }
    vid.currentTime = Math.min(2, vid.duration * 0.1);
    batchLoaded();
  });

  vid.addEventListener('seeked', () => {
    const vw = vid.videoWidth || 560, vh = vid.videoHeight || 316;
    const c = document.createElement('canvas');
    c.width = vw; c.height = vh;
    c.getContext('2d').drawImage(vid, 0, 0, vw, vh);
    const img = document.createElement('img');
    img.className = 'thumb-img';
    img.src = c.toDataURL('image/jpeg', 0.85);
    img.alt = ''; img.draggable = false;
    placeholder.style.display = 'none';
    thumbArea.insertBefore(img, thumbArea.querySelector('.play-btn'));
    const pv = document.createElement('video');
    pv.src = URL.createObjectURL(file);
    pv.className = 'preview-video'; pv.muted = true; pv.loop = true; pv.playsInline = true; pv.preload = 'none';
    thumbArea.insertBefore(pv, thumbArea.querySelector('.play-btn'));
    thumbArea.addEventListener('mouseenter', () => pv.play().catch(()=>{}));
    thumbArea.addEventListener('mouseleave', () => { pv.pause(); pv.currentTime = 0; });
    URL.revokeObjectURL(vid.src);
  });
}

function batchLoaded() {
  if (!_masonryBatch) return;
  _masonryBatch.loaded++;
  if (_masonryBatch.loaded >= _masonryBatch.total) {
    masonryReflow(_masonryBatch.cards, _masonryBatch.startX, _masonryBatch.startY);
    _masonryBatch = null;
  }
}

function applyCardWidth(el, ratio) {
  if (ratio < 0.65)      el.style.width = '160px';
  else if (ratio < 0.85) el.style.width = '200px';
  else if (ratio > 2.2)  el.style.width = '340px';
  else                   el.style.width = '260px';
}
function cardHeightFromRatio(ratio) {
  const w = ratio < 0.65 ? 160 : ratio < 0.85 ? 200 : ratio > 2.2 ? 340 : 260;
  return Math.round(w / ratio) + 72;
}

/* ── MASONRY ───────────────────────────── */
function masonryReflow(cards, centerX, startY) {
  const GAP = 16;
  const COLS = Math.max(2, Math.min(14, Math.round(Math.sqrt(cards.length * 1.3))));
  const COL_W = 260 + GAP;
  const offsetX = centerX - (COLS * COL_W / 2);
  const colH = new Array(COLS).fill(0);
  cards.forEach(card => {
    const ratio = card._ratio || 0.5625;
    const h = cardHeightFromRatio(ratio);
    const w = ratio < 0.65 ? 160 : ratio < 0.85 ? 200 : ratio > 2.2 ? 340 : 260;
    const col = colH.indexOf(Math.min(...colH));
    card.x = Math.round(offsetX + col * COL_W);
    card.y = Math.round(startY + colH[col]);
    colH[col] += h + GAP;
    const el = document.getElementById('card-' + card.id);
    if (el) { el.style.left = card.x + 'px'; el.style.top = card.y + 'px'; el.style.width = w + 'px'; }
  });
}

/* ── CANVAS LABELS ─────────────────────── */
function addLabelToCenter() {
  const x = (-state.panX / state.zoom) + (viewport.clientWidth  / 2 / state.zoom) - 80;
  const y = (-state.panY / state.zoom) + (viewport.clientHeight / 2 / state.zoom) - 30;
  const label = { id: genId(), text: 'Etiqueta', x: Math.round(x), y: Math.round(y), fontSize: 48 };
  state.labels.push(label);
  renderLabel(label);
  setTimeout(() => {
    const span = document.querySelector('#label-' + label.id + ' .canvas-label__text');
    if (span) { span.contentEditable = 'true'; span.focus(); selectAllText(span); }
  }, 50);
}

function renderLabel(label) {
  const old = document.getElementById('label-' + label.id);
  if (old) old.remove();
  const selKey = 'label:' + label.id;

  const wrap = document.createElement('div');
  wrap.className = 'canvas-label' + (state.selectedIds.has(selKey) ? ' selected' : '');
  wrap.id = 'label-' + label.id;
  wrap.style.left = label.x + 'px';
  wrap.style.top  = label.y + 'px';

  const span = document.createElement('div');
  span.className = 'canvas-label__text';
  span.contentEditable = state.selectMode ? 'false' : 'true';
  span.spellcheck = false;
  span.style.fontSize = label.fontSize + 'px';
  span.textContent = label.text;

  const del = document.createElement('button');
  del.className = 'canvas-label__delete';
  del.innerHTML = '×';
  del.onclick = e => {
    e.stopPropagation();
    wrap.remove();
    state.labels = state.labels.filter(l => l.id !== label.id);
    state.selectedIds.delete(selKey);
    updateSelectionBar();
  };

  wrap.appendChild(span);
  wrap.appendChild(del);
  canvas.appendChild(wrap);

  span.addEventListener('blur',  () => { label.text = span.textContent.trim() || 'Etiqueta'; span._editing = false; });
  span.addEventListener('focus', () => { span._editing = true; });

  span.addEventListener('dblclick', e => {
    if (state.selectMode) return;
    e.stopPropagation();
    span.contentEditable = 'true';
    span._editing = true;
    span.focus(); selectAllText(span);
  });

  span.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    stopPan();
    e.stopPropagation();

    if (state.selectMode) {
      if (state.selectedIds.has(selKey)) {
        const sx = (e.clientX - state.panX) / state.zoom;
        const sy = (e.clientY - state.panY) / state.zoom;
        startGroupDrag(e);
        function up(ev) {
          window.removeEventListener('mouseup', up);
          const dx = Math.abs((ev.clientX - state.panX) / state.zoom - sx);
          const dy = Math.abs((ev.clientY - state.panY) / state.zoom - sy);
          if (dx <= 4 && dy <= 4) toggleLabelSelect(label.id); // click = deselect
        }
        window.addEventListener('mouseup', up);
      } else {
        toggleLabelSelect(label.id);
      }
      return;
    }
    if (span._editing) return;

    let moved = false;
    const sx = (e.clientX - state.panX) / state.zoom;
    const sy = (e.clientY - state.panY) / state.zoom;
    const ox = label.x, oy = label.y;

    function mv(ev) {
      const dx = Math.abs((ev.clientX - state.panX) / state.zoom - sx);
      const dy = Math.abs((ev.clientY - state.panY) / state.zoom - sy);
      if (dx > 3 || dy > 3) moved = true;
      if (!moved) return;
      label.x = Math.round(ox + (ev.clientX - state.panX) / state.zoom - sx);
      label.y = Math.round(oy + (ev.clientY - state.panY) / state.zoom - sy);
      wrap.style.left = label.x + 'px'; wrap.style.top = label.y + 'px';
    }
    function up(ev) {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      if (!moved) {
        span.contentEditable = 'true';
        span._editing = true; span.focus();
        const range = document.caretRangeFromPoint?.(ev.clientX, ev.clientY);
        if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      }
    }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });

  wrap.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    label.fontSize = Math.max(16, Math.min(200, label.fontSize + (e.deltaY < 0 ? 4 : -4)));
    span.style.fontSize = label.fontSize + 'px';
  }, { passive: false });
}

/* ── CARD DRAG ─────────────────────────── */
function startCardDrag(e, card, el) {
  if (state.selectedIds.has(card.id)) { startGroupDrag(e); return; }
  const sx = (e.clientX - state.panX) / state.zoom;
  const sy = (e.clientY - state.panY) / state.zoom;
  const ox = card.x, oy = card.y;
  el.classList.add('dragging');
  function mv(ev) {
    card.x = Math.round(ox + (ev.clientX - state.panX) / state.zoom - sx);
    card.y = Math.round(oy + (ev.clientY - state.panY) / state.zoom - sy);
    el.style.left = card.x + 'px'; el.style.top = card.y + 'px';
  }
  function up() { el.classList.remove('dragging'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
}

function startGroupDrag(e) {
  const sx = (e.clientX - state.panX) / state.zoom;
  const sy = (e.clientY - state.panY) / state.zoom;
  let moved = false;

  const items = [];
  state.selectedIds.forEach(key => {
    if (key.startsWith('label:')) {
      const l = state.labels.find(l => l.id === key.slice(6));
      if (l) items.push({ obj: l, ox: l.x, oy: l.y, el: document.getElementById('label-' + l.id) });
    } else {
      const c = state.cards.find(c => c.id === key);
      if (c) items.push({ obj: c, ox: c.x, oy: c.y, el: document.getElementById('card-' + c.id) });
    }
  });

  function mv(ev) {
    const dx = (ev.clientX - state.panX) / state.zoom - sx;
    const dy = (ev.clientY - state.panY) / state.zoom - sy;
    if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
    if (!moved) return;
    items.forEach(item => {
      item.obj.x = Math.round(item.ox + dx); item.obj.y = Math.round(item.oy + dy);
      if (item.el) { item.el.style.left = item.obj.x + 'px'; item.el.style.top = item.obj.y + 'px'; }
    });
  }
  function up() {
    window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
    // If didn't move = it was a click → the calling handler will toggle selection
  }
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
}

/* ── ZOOM ──────────────────────────────── */
function onWheel(e) {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
}
function zoomAtPoint(mx, my, delta) {
  const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom + delta));
  if (nz === state.zoom) return;
  state.panX = mx - (mx - state.panX) * (nz / state.zoom);
  state.panY = my - (my - state.panY) * (nz / state.zoom);
  state.zoom = nz; applyTransform();
}
function adjustZoom(d) { zoomAtPoint(viewport.clientWidth/2, viewport.clientHeight/2, d); }
function resetView()   { state.zoom = 1; state.panX = 0; state.panY = 0; applyTransform(); }
function applyTransform() {
  canvas.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
}

/* ── SELECTION ─────────────────────────── */
function toggleSelectMode() {
  state.selectMode = !state.selectMode;
  document.getElementById('btn-select-mode').classList.toggle('active', state.selectMode);
  viewport.classList.toggle('select-mode', state.selectMode);
  document.body.toggleAttribute('data-select-mode', state.selectMode);
  document.querySelectorAll('.canvas-label__text').forEach(span => {
    span.contentEditable = state.selectMode ? 'false' : 'true';
    if (state.selectMode) span.blur();
  });
  if (!state.selectMode) clearSelection();
  toast(state.selectMode ? 'Modo selección activado' : 'Modo selección desactivado', 'info');
}

function toggleCardSelect(id) {
  state.selectedIds.has(id) ? state.selectedIds.delete(id) : state.selectedIds.add(id);
  const el = document.getElementById('card-' + id);
  if (el) el.classList.toggle('selected', state.selectedIds.has(id));
  updateSelectionBar();
}
function toggleLabelSelect(labelId) {
  const key = 'label:' + labelId;
  state.selectedIds.has(key) ? state.selectedIds.delete(key) : state.selectedIds.add(key);
  const el = document.getElementById('label-' + labelId);
  if (el) el.classList.toggle('selected', state.selectedIds.has(key));
  updateSelectionBar();
}
function selectAll() {
  state.cards.forEach(c => { state.selectedIds.add(c.id); document.getElementById('card-'+c.id)?.classList.add('selected'); });
  state.labels.forEach(l => { state.selectedIds.add('label:'+l.id); document.getElementById('label-'+l.id)?.classList.add('selected'); });
  updateSelectionBar();
}
function clearSelection() {
  state.selectedIds.forEach(key => {
    const elId = key.startsWith('label:') ? 'label-'+key.slice(6) : 'card-'+key;
    document.getElementById(elId)?.classList.remove('selected');
  });
  state.selectedIds.clear();
  updateSelectionBar();
}
function updateSelectionBar() {
  const n = state.selectedIds.size;
  selBar[n > 0 ? 'removeAttribute' : 'setAttribute']('hidden', '');
  selCount.textContent = `${n} elemento${n > 1 ? 's' : ''} seleccionado${n > 1 ? 's' : ''}`;
}
function getSelectedCards() { return state.cards.filter(c => state.selectedIds.has(c.id)); }

/* ── FILTER ────────────────────────────── */
function filterCards() {
  state.cards.forEach(c => { const el = document.getElementById('card-'+c.id); if (el) applyCardVisibility(c, el); });
}
function applyCardVisibility(card, el) {
  const ok = (!state.searchQuery || card.name.toLowerCase().includes(state.searchQuery))
          && (!state.activeTagFilter || card.tags.includes(state.activeTagFilter));
  el.style.display = ok ? '' : 'none';
}
function renderTagFilter() {
  tagFilter.innerHTML = '';
  state.tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (state.activeTagFilter === tag.id ? ' active' : '');
    chip.textContent = tag.name; chip.style.color = tag.color; chip.style.background = tag.color + '1a';
    chip.onclick = () => { state.activeTagFilter = state.activeTagFilter === tag.id ? null : tag.id; renderTagFilter(); filterCards(); };
    tagFilter.appendChild(chip);
  });
}
function renderCardTags(card) {
  const el = document.getElementById('tags-' + card.id); if (!el) return;
  el.innerHTML = '';
  card.tags.forEach(tid => {
    const tag = state.tags.find(t => t.id === tid); if (!tag) return;
    const s = document.createElement('span');
    s.className = 'card-tag'; s.textContent = tag.name;
    s.style.background = tag.color+'33'; s.style.color = tag.color;
    el.appendChild(s);
  });
}

/* ── CONTEXT MENU ──────────────────────── */
function showContextMenu(e, cardId) {
  state.contextCardId = cardId;
  contextMenu.removeAttribute('hidden');
  contextMenu.style.left = Math.min(e.clientX, window.innerWidth-200) + 'px';
  contextMenu.style.top  = Math.min(e.clientY, window.innerHeight-200) + 'px';
}
function hideContextMenu() { contextMenu.setAttribute('hidden',''); state.contextCardId = null; }
function onContextMenuAction(e) {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const id = state.contextCardId; hideContextMenu(); if (!id) return;
  if (btn.dataset.action === 'rename')     openRenameModal(id);
  if (btn.dataset.action === 'tag')        { state.tagModalMulti = false; openTagModal(id); }
  if (btn.dataset.action === 'select-add') { if (!state.selectMode) toggleSelectMode(); toggleCardSelect(id); }
  if (btn.dataset.action === 'duplicate')  duplicateCard(id);
  if (btn.dataset.action === 'remove')     removeCard(id);
}

/* ── RENAME SINGLE ─────────────────────── */
function openRenameModal(id) {
  state.renameCardId = id;
  renameInput.value = state.cards.find(c => c.id === id)?.name || '';
  openModal(modalRename);
  setTimeout(() => { renameInput.select(); renameInput.focus(); }, 50);
}
function confirmRename() {
  const name = renameInput.value.trim(); if (!name) return;
  const card = state.cards.find(c => c.id === state.renameCardId); if (!card) return;
  card.name = name;
  const el = document.getElementById('title-' + card.id);
  if (el) { el.textContent = name; el.title = name; }
  closeModal(modalRename); toast('Video renombrado', 'success');
}

/* ── RENAME MULTI ──────────────────────── */
function openRenameMultiModal() {
  if (!state.selectedIds.size) return;
  document.getElementById('rename-multi-count').textContent = state.selectedIds.size;
  const patternEl = document.getElementById('rename-pattern');
  patternEl.value = '';
  document.getElementById('rename-preview').innerHTML = '<span style="color:var(--text-3)">Escribe arriba para ver el resultado</span>';
  openModal(modalRenameM);
  setTimeout(() => patternEl.focus(), 50);
}
function updateRenamePreview() {
  const pattern = document.getElementById('rename-pattern').value;
  const preview = document.getElementById('rename-preview');
  if (!pattern.trim()) {
    preview.innerHTML = '<span style="color:var(--text-3)">Escribe arriba para ver el resultado</span>';
    return;
  }
  const cards = getSelectedCards().slice(0, 5);
  preview.innerHTML = cards.map((c, i) =>
    `<span><b>${escHtml(buildNewName(c.name, i + 1, pattern))}</b></span>`
  ).join('');
  const total = getSelectedCards().length;
  if (total > 5) preview.innerHTML += `<span style="color:var(--text-3)">… y ${total - 5} más</span>`;
}
function buildNewName(orig, n, pattern) {
  const num = String(n).padStart(3, '0');
  if (!pattern || !pattern.trim()) return orig;
  return pattern.replace(/\{n\}/g, num).replace(/\{name\}/g, orig);
}
function confirmRenameMulti() {
  const pattern = document.getElementById('rename-pattern').value.trim();
  if (!pattern) { toast('Escribe un patrón primero', 'error'); return; }
  const cards = getSelectedCards();
  cards.forEach((card, i) => {
    card.name = buildNewName(card.name, i + 1, pattern);
    const el = document.getElementById('title-' + card.id);
    if (el) { el.textContent = card.name; el.title = card.name; }
  });
  closeModal(modalRenameM);
  toast(`${cards.length} elemento${cards.length > 1 ? 's' : ''} renombrado${cards.length > 1 ? 's' : ''}`, 'success');
}

/* ── SORT ──────────────────────────────── */
function confirmSort() {
  const val = document.querySelector('input[name="sort-by"]:checked').value;
  const cards = getSelectedCards().length > 0 ? getSelectedCards() : [...state.cards];
  cards.sort((a, b) => {
    if (val === 'name-asc')      return a.name.localeCompare(b.name);
    if (val === 'name-desc')     return b.name.localeCompare(a.name);
    if (val === 'duration-asc')  return (a.duration||0) - (b.duration||0);
    if (val === 'duration-desc') return (b.duration||0) - (a.duration||0);
    if (val === 'size-asc')      return (a._size||0) - (b._size||0);
    if (val === 'size-desc')     return (b._size||0) - (a._size||0);
    return 0;
  });
  const cx = (-state.panX/state.zoom) + (viewport.clientWidth/2/state.zoom);
  const cy = (-state.panY/state.zoom) + (viewport.clientHeight/2/state.zoom) - 200;
  masonryReflow(cards, cx, cy);
  closeModal(modalSort); toast('Videos ordenados', 'success');
}

/* ── TAG MODAL ─────────────────────────── */
function openTagModal(id) { state.tagModalCardId = id; state.tagModalMulti = false; renderTagPicker(); openModal(modalTag); }
function renderTagPicker() {
  const card = state.cards.find(c => c.id === state.tagModalCardId);
  tagPicker.innerHTML = '';
  if (!state.tags.length) { tagPicker.innerHTML = '<span style="color:var(--text-3);font-size:13px">Crea etiquetas abajo</span>'; return; }
  state.tags.forEach(tag => {
    const sel = card && card.tags.includes(tag.id);
    const item = document.createElement('div');
    item.className = 'tag-pick-item' + (sel ? ' selected' : '');
    item.style.color = tag.color; item.style.background = tag.color + '22';
    item.innerHTML = `<span class="tag-pick-check">${sel?'✓':''}</span>${escHtml(tag.name)}`;
    item.setAttribute('data-tag-id', tag.id);
    item.onclick = () => { item.classList.toggle('selected'); item.querySelector('.tag-pick-check').textContent = item.classList.contains('selected') ? '✓' : ''; };
    tagPicker.appendChild(item);
  });
}
function addNewTag() {
  const name = newTagInput.value.trim(); if (!name) return;
  state.tags.push({ id: genId(), name, color: newTagColor.value });
  newTagInput.value = ''; renderTagPicker(); renderTagFilter(); toast(`Etiqueta "${name}" creada`, 'info');
}
function confirmTags() {
  const selIds = Array.from(tagPicker.querySelectorAll('.tag-pick-item.selected')).map(el => el.dataset.tagId);
  if (state.tagModalMulti) {
    getSelectedCards().forEach(card => { card.tags = [...new Set([...card.tags, ...selIds])]; renderCardTags(card); });
  } else {
    const card = state.cards.find(c => c.id === state.tagModalCardId);
    if (card) { card.tags = selIds; renderCardTags(card); }
  }
  closeModal(modalTag); renderTagFilter(); toast('Etiquetas guardadas', 'success');
}

/* ── DUPLICATE / REMOVE ────────────────── */
function duplicateCard(id) {
  const orig = state.cards.find(c => c.id === id); if (!orig) return;
  const card = { ...orig, id: genId(), x: orig.x+30, y: orig.y+30, tags: [...orig.tags] };
  state.cards.push(card); fileMap[card.id] = fileMap[orig.id]||null;
  renderCard(card, fileMap[card.id]); toast('Tarjeta duplicada', 'info');
}
function removeCard(id) {
  state.cards = state.cards.filter(c => c.id !== id); delete fileMap[id];
  document.getElementById('card-'+id)?.remove();
  updateEmptyState(); toast('Eliminado', 'info');
}

/* ── PLAYER ────────────────────────────── */
function openPlayer(card) {
  const file = fileMap[card.id];
  if (!file) { toast('Archivo no disponible — recarga la carpeta', 'error'); return; }
  let imgEl = document.getElementById('player-img');
  if (file.type.startsWith('image/')) {
    playerVideo.style.display = 'none';
    if (!imgEl) {
      imgEl = document.createElement('img');
      imgEl.id = 'player-img';
      imgEl.style.cssText = 'max-width:100%;max-height:80vh;border-radius:12px;display:block;margin:0 auto;box-shadow:0 32px 100px #00000099';
      playerVideo.parentNode.insertBefore(imgEl, playerVideo);
    }
    imgEl.src = URL.createObjectURL(file);
    imgEl.style.display = 'block';
  } else {
    if (imgEl) imgEl.style.display = 'none';
    playerVideo.style.display = 'block';
    playerVideo.src = URL.createObjectURL(file);
    playerVideo.play().catch(()=>{});
  }
  playerTitle.textContent = card.name;
  playerOverlay.removeAttribute('hidden');
}
function closePlayer() {
  playerVideo.pause(); playerVideo.src = '';
  const imgEl = document.getElementById('player-img');
  if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
  playerVideo.style.display = 'block';
  playerOverlay.setAttribute('hidden', '');
}

/* ── MODALS ────────────────────────────── */
function openModal(el)  { el.removeAttribute('hidden'); }
function closeModal(el) { el.setAttribute('hidden', ''); }

/* ── THEME ─────────────────────────────── */
function applyTheme() { const s = localStorage.getItem('vc-theme'); if (s) document.documentElement.setAttribute('data-theme', s); }
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next); localStorage.setItem('vc-theme', next);
}

/* ── EXPORT BAT ────────────────────────── */
function exportBat() {
  // Only cards that have a file loaded AND whose name differs from the original filename
  const pairs = state.cards
    .map(card => {
      const file = fileMap[card.id];
      if (!file) return null;
      const origBase = file.name.replace(/\.[^/.]+$/, '');   // original name without extension
      const ext      = file.name.match(/\.[^/.]+$/)?.[0] || '';
      const newName  = card.name.trim();
      if (!newName || newName === origBase) return null;      // skip unchanged
      return { orig: file.name, newFull: newName + ext };
    })
    .filter(Boolean);

  if (!pairs.length) {
    toast('No hay archivos con nombres cambiados', 'error');
    return;
  }

  // Build .bat content
  const lines = [
    '@echo off',
    'chcp 65001 > nul',
    'echo VideoCanvas — Renombrado de archivos',
    'echo Se renombrarán ' + pairs.length + ' archivo(s).',
    'echo.',
    'pause',
    'echo.',
    ...pairs.map(p => {
      // Escape special chars for batch
      const orig = p.orig.replace(/[&^|<>]/g, '^$&');
      const dest = p.newFull.replace(/[&^|<>]/g, '^$&');
      return `ren "${orig}" "${dest}"\necho OK: ${orig} -> ${dest}`;
    }),
    'echo.',
    'echo ¡Listo! Presiona una tecla para cerrar.',
    'pause > nul',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'renombrar.bat';
  a.click();
  URL.revokeObjectURL(url);
  toast(`Script exportado — ${pairs.length} archivo${pairs.length > 1 ? 's' : ''}`, 'success');
}
function clearCanvas() {
  const n = state.cards.length + state.labels.length;
  if (!n) { toast('El canvas ya está vacío', 'info'); return; }
  if (!confirm(`¿Eliminar ${n} elemento${n>1?'s':''} del canvas?`)) return;
  state.cards.forEach(c => document.getElementById('card-'+c.id)?.remove());
  state.labels.forEach(l => document.getElementById('label-'+l.id)?.remove());
  state.cards = []; state.labels = []; fileMap = {};
  state.selectedIds.clear(); updateSelectionBar();
  localStorage.removeItem('videocanvas-layout'); updateEmptyState(); toast('Canvas limpiado', 'info');
}

/* ── PERSISTENCE ───────────────────────── */
function saveToStorage() {
  try {
    localStorage.setItem('videocanvas-layout', JSON.stringify({
      cards:  state.cards.map(({id,name,tags,x,y,duration,_ratio,_size}) => ({id,name,tags,x,y,duration,_ratio,_size})),
      labels: state.labels, tags: state.tags,
      zoom: state.zoom, panX: state.panX, panY: state.panY,
    }));
    toast('Layout guardado ✓', 'success');
  } catch { toast('No se pudo guardar', 'error'); }
}
function loadFromStorage() {
  try {
    const d = JSON.parse(localStorage.getItem('videocanvas-layout') || 'null');
    if (!d) return;
    state.cards = d.cards||[]; state.labels = d.labels||[]; state.tags = d.tags||[];
    state.zoom = d.zoom??1; state.panX = d.panX??0; state.panY = d.panY??0;
  } catch {}
}

/* ── UTILS ─────────────────────────────── */
function updateEmptyState() { emptyState.classList.toggle('hidden', state.cards.length > 0 || state.labels.length > 0); }
function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`; el.textContent = msg; toastCont.appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); el.addEventListener('animationend', () => el.remove()); }, 3000);
}
function genId()          { return Math.random().toString(36).slice(2,11); }
function cleanName(f)     { return f.replace(/\.[^/.]+$/,'').replace(/[_-]+/g,' ').trim(); }
function formatDuration(s){ const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`; }
function formatSize(b)    { return b>=1e9?(b/1e9).toFixed(1)+' GB':b>=1e6?(b/1e6).toFixed(1)+' MB':(b/1e3).toFixed(0)+' KB'; }
function escHtml(s)       { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function selectAllText(el){ const r=document.createRange(); r.selectNodeContents(el); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); }
