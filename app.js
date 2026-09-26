const API = 'https://jshandloom-admin-api.onrender.com';

// ── State ─────────────────────────────────────────────────────────────────────
let selectedPhotos = [];
let photoURLs      = [];
let currentDraft   = null;
let currentSessionId = null;

let allProducts = [];
let imageBase   = '';
let origLiveIds = new Set();
let origFeatIds = new Set();
let curLiveIds  = new Set();
let curFeatIds  = new Set();

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  if (localStorage.getItem('token')) showApp();
  document.getElementById('pin-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
  initPhotoUpload();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login() {
  const pin = document.getElementById('pin-input').value.trim();
  if (!pin) return;

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  hideMsg('login-error');

  try {
    const res  = await fetch(`${API}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError('login-error', data.detail || 'Something went wrong. Please try again.');
    } else {
      localStorage.setItem('token', data.token);
      showApp();
    }
  } catch {
    showError('login-error', 'Could not reach the server. Please check your connection.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

function logout() {
  localStorage.removeItem('token');
  document.getElementById('pin-input').value = '';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  resetAddForm();
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  btn.classList.add('active');
  if (name === 'manage') loadManage();
}

// ── Add tab — photo upload ────────────────────────────────────────────────────
function initPhotoUpload() {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('photo-input');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    addPhotos([...e.dataTransfer.files]);
  });
  input.addEventListener('change', () => {
    addPhotos([...input.files]);
    input.value = '';
  });
}

function addPhotos(files) {
  const images = files.filter(f => f.type.startsWith('image/'));
  const space  = 5 - selectedPhotos.length;
  selectedPhotos = [...selectedPhotos, ...images.slice(0, space)];
  renderThumbs();
}

function removePhoto(idx) {
  selectedPhotos.splice(idx, 1);
  renderThumbs();
}

function renderThumbs() {
  photoURLs.forEach(u => URL.revokeObjectURL(u));
  photoURLs = selectedPhotos.map(f => URL.createObjectURL(f));

  const grid = document.getElementById('photo-thumbs');
  const zone = document.getElementById('upload-zone');

  if (selectedPhotos.length === 0) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    zone.classList.remove('hidden');
    return;
  }

  zone.classList.add('hidden');
  grid.classList.remove('hidden');

  const thumbs = photoURLs.map((url, i) => `
    <div class="thumb-item">
      <img src="${url}" class="thumb-img" alt="Photo ${i + 1}" />
      <button class="thumb-remove" onclick="removePhoto(${i})" aria-label="Remove photo">&times;</button>
    </div>`).join('');

  const addMore = selectedPhotos.length < 5
    ? `<div class="thumb-add" onclick="document.getElementById('photo-input').click()">
         <span>+</span><span>Add</span>
       </div>`
    : '';

  grid.innerHTML = thumbs + addMore;
}

// ── Add tab — generate ────────────────────────────────────────────────────────
async function startGenerate() {
  if (selectedPhotos.length === 0) {
    showError('generate-error', 'Please add at least one photo before generating.');
    return;
  }
  hideMsg('generate-error');

  document.getElementById('add-step-1').classList.add('hidden');
  document.getElementById('add-step-2').classList.remove('hidden');
  document.getElementById('gen-loading').classList.remove('hidden');
  document.getElementById('add-review').classList.add('hidden');

  const fd = new FormData();
  selectedPhotos.forEach(f => fd.append('photos', f));
  fd.append('notes',        document.getElementById('notes').value.trim());
  fd.append('price',        document.getElementById('price').value.trim());
  fd.append('availability', document.getElementById('availability').value);

  try {
    const res  = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'x-token': token() },
      body: fd,
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      document.getElementById('add-step-2').classList.add('hidden');
      document.getElementById('add-step-1').classList.remove('hidden');
      showError('generate-error', data.detail || 'Could not analyse the photos. Please try again.');
    } else {
      currentDraft     = data.draft;
      currentSessionId = data.sessionId;
      document.getElementById('gen-loading').classList.add('hidden');
      document.getElementById('add-review').classList.remove('hidden');
      showReviewScreen();
    }
  } catch {
    document.getElementById('add-step-2').classList.add('hidden');
    document.getElementById('add-step-1').classList.remove('hidden');
    showError('generate-error', 'Could not reach the server. Please check your connection.');
  }
}

function resetAddForm() {
  selectedPhotos = [];
  photoURLs.forEach(u => URL.revokeObjectURL(u));
  photoURLs        = [];
  currentDraft     = null;
  currentSessionId = null;

  const f = id => document.getElementById(id);
  if (f('notes'))        f('notes').value        = '';
  if (f('price'))        f('price').value        = '';
  if (f('availability')) f('availability').value = '';

  renderThumbs();
  f('add-step-2').classList.add('hidden');
  f('add-step-1').classList.remove('hidden');
  f('add-review').classList.add('hidden');
  f('confirm-success').classList.add('hidden');
  f('gen-loading').classList.remove('hidden');
  hideMsg('generate-error');
}

// ── Add tab — review screen ───────────────────────────────────────────────────
const REVIEW_FIELDS = [
  { key: 'name',         label: 'Product name',     type: 'text',     required: true },
  { key: 'category',     label: 'Category',          type: 'text' },
  { key: 'colour',       label: 'Colour',            type: 'text' },
  { key: 'work',         label: 'Craft / Work',      type: 'text' },
  { key: 'availability', label: 'Availability',      type: 'select',
    options: ['In Stock', 'Made to Order'] },
  { key: 'price',        label: 'Price',             type: 'text',
    placeholder: '₹12,500  or  Price on enquiry' },
  { key: 'description',  label: 'Short description', type: 'textarea' },
  { key: 'fabricDetails',label: 'Fabric details',    type: 'textarea' },
];

function showReviewScreen() {
  const anyFlagged = REVIEW_FIELDS.some(f => currentDraft[`${f.key}_needsReview`]);
  document.getElementById('review-banner').classList.toggle('hidden', !anyFlagged);

  renderReviewPhotos();

  document.getElementById('review-fields').innerHTML = REVIEW_FIELDS.map(f => {
    const val    = currentDraft[f.key] || '';
    const flagged = !!currentDraft[`${f.key}_needsReview`];
    const badge  = flagged ? '<span class="needs-review-badge">Needs review</span>' : '';
    const cls    = `form-group${flagged ? ' needs-review' : ''}`;

    if (f.type === 'select') {
      const opts = (f.options || []).map(o =>
        `<option${o === val ? ' selected' : ''}>${o}</option>`
      ).join('');
      return `<div class="${cls}">
        <label for="rv-${f.key}">${f.label}${badge}</label>
        <select id="rv-${f.key}" class="form-control"><option value=""></option>${opts}</select>
      </div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="${cls}">
        <label for="rv-${f.key}">${f.label}${badge}</label>
        <textarea id="rv-${f.key}" class="form-control">${escHtml(val)}</textarea>
      </div>`;
    }
    const ph = f.placeholder ? ` placeholder="${f.placeholder}"` : '';
    return `<div class="${cls}">
      <label for="rv-${f.key}">${f.label}${badge}</label>
      <input type="text" id="rv-${f.key}" class="form-control" value="${escAttr(val)}"${ph} />
    </div>`;
  }).join('');

  const toggle = document.getElementById('featured-toggle');
  if (toggle) toggle.classList.toggle('on', !!currentDraft.isFeatured);
}

function renderReviewPhotos() {
  photoURLs.forEach(u => URL.revokeObjectURL(u));
  photoURLs = selectedPhotos.map(f => URL.createObjectURL(f));
  const grid = document.getElementById('review-photo-grid');
  if (!grid) return;
  const n = selectedPhotos.length;
  grid.innerHTML = photoURLs.map((url, i) => `
    <div class="review-photo-item">
      <div class="review-photo-img-wrap">
        <img src="${url}" alt="Photo ${i + 1}" />
      </div>
      <p class="review-photo-badge">${i === 0 ? 'Main' : ''}</p>
      <div class="review-photo-arrows">
        <button class="arrow-btn" onclick="movePhoto(${i},-1)" ${i === 0 ? 'disabled' : ''}>&#8592;</button>
        <button class="arrow-btn" onclick="movePhoto(${i},1)"  ${i === n - 1 ? 'disabled' : ''}>&#8594;</button>
      </div>
    </div>`).join('');
}

function movePhoto(idx, dir) {
  const ni = idx + dir;
  if (ni < 0 || ni >= selectedPhotos.length) return;
  [selectedPhotos[idx], selectedPhotos[ni]] = [selectedPhotos[ni], selectedPhotos[idx]];
  if (currentDraft.images) {
    [currentDraft.images[idx], currentDraft.images[ni]] = [currentDraft.images[ni], currentDraft.images[idx]];
  }
  renderReviewPhotos();
}

function toggleFeatured() {
  currentDraft.isFeatured = !currentDraft.isFeatured;
  const t = document.getElementById('featured-toggle');
  if (t) t.classList.toggle('on', currentDraft.isFeatured);
}

function getReviewDraft() {
  const draft = { ...currentDraft };
  REVIEW_FIELDS.forEach(f => {
    const el = document.getElementById(`rv-${f.key}`);
    if (el) draft[f.key] = el.value.trim() || null;
  });
  return draft;
}

async function submitConfirm() {
  const draft = getReviewDraft();
  const btn   = document.getElementById('confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating PR…';
  hideMsg('confirm-error');

  try {
    const res  = await fetch(`${API}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token() },
      body: JSON.stringify({ sessionId: currentSessionId, draft }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('confirm-error', data.detail || 'Could not create the pull request. Please try again.');
    } else {
      document.getElementById('add-review').classList.add('hidden');
      document.getElementById('pr-link').href = data.pr_url;
      document.getElementById('confirm-success').classList.remove('hidden');
    }
  } catch {
    showError('confirm-error', 'Could not reach the server. Please check your connection.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit & create PR';
  }
}

// ── Manage tab ────────────────────────────────────────────────────────────────
async function loadManage() {
  const f = id => document.getElementById(id);
  f('manage-loading').classList.remove('hidden');
  f('manage-content').classList.add('hidden');
  f('manage-empty').classList.add('hidden');
  f('manage-fetch-error').classList.add('hidden');

  try {
    const res  = await fetch(`${API}/products`, { headers: { 'x-token': token() } });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('manage-fetch-error', data.detail || 'Could not load products.');
      return;
    }

    allProducts = data.all || [];
    imageBase   = data.imageBase || '';
    origLiveIds = new Set(data.liveIds || []);
    origFeatIds = new Set(allProducts.filter(p => p.isFeatured).map(p => p.id));
    curLiveIds  = new Set(origLiveIds);
    curFeatIds  = new Set(origFeatIds);

    f('manage-loading').classList.add('hidden');

    if (allProducts.length === 0) {
      f('manage-empty').classList.remove('hidden');
      return;
    }

    renderProductList();
    const n = allProducts.length;
    f('manage-count').textContent = `${n} product${n === 1 ? '' : 's'} in your catalog`;
    f('manage-content').classList.remove('hidden');
    updateSaveBtn();
    hideMsg('manage-save-success');
    hideMsg('manage-save-error');
  } catch {
    f('manage-loading').classList.add('hidden');
    showError('manage-fetch-error', 'Could not reach the server. Please check your connection.');
  }
}

function renderProductList() {
  document.getElementById('product-list').innerHTML = allProducts.map(p => {
    const live    = curLiveIds.has(p.id);
    const feat    = curFeatIds.has(p.id);
    const meta    = [p.category, p.colour].filter(Boolean).join(' · ') || '—';
    const imgPath = p.images && p.images[0];
    const imgSrc  = imgPath ? `${imageBase}/${imgPath}` : '';
    const imgHtml = imgSrc
      ? `<img class="product-card-img" src="${imgSrc}" alt="${escAttr(p.name || '')}" />`
      : `<div class="product-card-img product-card-img-placeholder"></div>`;

    return `
      <div class="product-card">
        ${imgHtml}
        <div class="product-card-info">
          <p class="product-card-name">${escHtml(p.name || p.id)}</p>
          <p class="product-card-meta">${escHtml(meta)}</p>
        </div>
        <div class="product-card-toggles">
          <div class="mini-toggle-col">
            <span class="mini-toggle-label">Live</span>
            <div class="toggle-switch sm${live ? ' on' : ''}" id="live-${p.id}"
                 onclick="toggleLive('${p.id}')">
              <div class="toggle-knob"></div>
            </div>
          </div>
          <div class="mini-toggle-col">
            <span class="mini-toggle-label">Featured</span>
            <div class="toggle-switch sm${feat ? ' on' : ''}" id="feat-${p.id}"
                 onclick="toggleManageFeatured('${p.id}')">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleLive(id) {
  curLiveIds.has(id) ? curLiveIds.delete(id) : curLiveIds.add(id);
  document.getElementById(`live-${id}`)?.classList.toggle('on', curLiveIds.has(id));
  updateSaveBtn();
}

function toggleManageFeatured(id) {
  curFeatIds.has(id) ? curFeatIds.delete(id) : curFeatIds.add(id);
  document.getElementById(`feat-${id}`)?.classList.toggle('on', curFeatIds.has(id));
  updateSaveBtn();
}

function hasManageChanges() {
  const same = (a, b) => [...a].sort().join(',') === [...b].sort().join(',');
  return !same(curLiveIds, origLiveIds) || !same(curFeatIds, origFeatIds);
}

function updateSaveBtn() {
  const btn = document.getElementById('save-manage-btn');
  if (btn) btn.disabled = !hasManageChanges();
}

async function saveManage() {
  const btn = document.getElementById('save-manage-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating PR…';
  hideMsg('manage-save-success');
  hideMsg('manage-save-error');

  try {
    const res  = await fetch(`${API}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token() },
      body: JSON.stringify({ checkedIds: [...curLiveIds], featuredIds: [...curFeatIds] }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('manage-save-error', data.detail || 'Could not save changes. Please try again.');
      btn.disabled = false;
    } else {
      origLiveIds = new Set(curLiveIds);
      origFeatIds = new Set(curFeatIds);
      const el = document.getElementById('manage-save-success');
      el.innerHTML = `Changes submitted. <a href="${data.pr_url}" target="_blank" class="pr-link">View PR &rarr;</a>`;
      el.classList.remove('hidden');
    }
  } catch {
    showError('manage-save-error', 'Could not reach the server. Please check your connection.');
    btn.disabled = false;
  } finally {
    btn.textContent = 'Save changes';
    updateSaveBtn();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function token() { return localStorage.getItem('token') || ''; }

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideMsg(id) {
  document.getElementById(id)?.classList.add('hidden');
}
