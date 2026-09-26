const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://jshandloom-admin-api.onrender.com';

// ── State ─────────────────────────────────────────────────────────────────────
let selectedPhotos    = [];
let photoURLs         = [];
let currentDraft      = null;
let currentSessionId  = null;
let currentCategories = [];

let allProducts   = [];
let allCategories = [];
let imageBase     = '';
let origLiveIds   = new Set();
let origFeatIds   = new Set();
let curLiveIds    = new Set();
let curFeatIds    = new Set();

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
  loadManage();
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  btn.classList.add('active');
  if (name === 'products') {
    document.getElementById('products-add-view').classList.add('hidden');
    document.getElementById('products-list-view').classList.remove('hidden');
    loadManage();
  }
  if (name === 'categories') loadCategories();
}

// ── Products tab — navigation ─────────────────────────────────────────────────
function showAddProduct() {
  document.getElementById('products-list-view').classList.add('hidden');
  document.getElementById('products-add-view').classList.remove('hidden');
}

function backToProducts() {
  resetAddForm();
  document.getElementById('products-add-view').classList.add('hidden');
  document.getElementById('products-list-view').classList.remove('hidden');
}

// ── Add product — photo upload ────────────────────────────────────────────────
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

// ── Add product — generate ────────────────────────────────────────────────────
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
      currentDraft      = data.draft;
      currentSessionId  = data.sessionId;
      currentCategories = data.categories || [];
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
  selectedPhotos    = [];
  photoURLs.forEach(u => URL.revokeObjectURL(u));
  photoURLs         = [];
  currentDraft      = null;
  currentSessionId  = null;
  currentCategories = [];

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

// ── Add product — review screen ───────────────────────────────────────────────
const REVIEW_FIELDS = [
  { key: 'name',         label: 'Product name',     type: 'text',     required: true },
  { key: 'category',     label: 'Category',          type: 'text',     required: true },
  { key: 'colour',       label: 'Colour',            type: 'text',     required: true },
  { key: 'work',         label: 'Craft / Work',      type: 'text',     required: true },
  { key: 'availability', label: 'Availability',      type: 'select',   required: true,
    options: ['In Stock', 'Made to Order'] },
  { key: 'price',        label: 'Price',             type: 'text',
    placeholder: '₹12,500  or  Price on enquiry' },
  { key: 'description',  label: 'Short description', type: 'textarea', required: true },
  { key: 'fabricDetails',label: 'Fabric details',    type: 'textarea', required: true },
];

function showReviewScreen() {
  const anyFlagged = REVIEW_FIELDS.some(f => currentDraft[`${f.key}_needsReview`]);
  document.getElementById('review-banner').classList.toggle('hidden', !anyFlagged);

  renderReviewPhotos();

  const baseId = currentDraft.id || '';
  const initColour = (currentDraft.colour || '').toUpperCase().replace(/\s+/g, '-');
  const initDisplayId = initColour ? `${baseId}-${initColour}` : baseId;
  const idHtml = baseId
    ? `<div class="form-group">
        <label>Product ID</label>
        <input type="text" id="review-id-display" class="form-control" value="${escAttr(initDisplayId)}" disabled />
       </div>`
    : '';

  document.getElementById('review-fields').innerHTML = idHtml + REVIEW_FIELDS.map(f => {
    const val     = currentDraft[f.key] || '';
    const flagged = !!currentDraft[`${f.key}_needsReview`];
    const badge   = flagged ? '<span class="needs-review-badge">Needs review</span>' : '';
    const reqStar = f.required ? '<span class="required-star">*</span>' : '';
    const cls     = `form-group${flagged ? ' needs-review' : ''}`;

    if (f.key === 'category' && currentCategories.length > 0) {
      const categoryNames = currentCategories.map(c => c.name);
      const isInList  = val && categoryNames.includes(val);
      const selectVal = val ? (isInList ? val : 'other') : '';
      const opts = currentCategories.map(c =>
        `<option value="${escAttr(c.name)}"${c.name === selectVal ? ' selected' : ''}>${escHtml(c.name)}</option>`
      ).join('');
      const otherSelected  = selectVal === 'other' ? ' selected' : '';
      const wrapHidden     = selectVal === 'other' ? '' : ' style="display:none"';
      const otherVal       = selectVal === 'other' ? escAttr(val) : '';
      const placeholderSel = !selectVal ? ' selected' : '';
      return `<div class="${cls}" id="fg-${f.key}">
        <label for="rv-${f.key}">${f.label}${reqStar}${badge}</label>
        <select id="rv-${f.key}" class="form-control" onchange="onCategoryChange()">
          <option value="" disabled${placeholderSel}>Select category</option>
          ${opts}
          <option value="other"${otherSelected}>Other</option>
        </select>
        <div id="rv-category-other-wrap" class="form-group"${wrapHidden}>
          <label for="rv-category-other">Specify category</label>
          <input type="text" id="rv-category-other" class="form-control"
                 placeholder="e.g. Baluchari Silk" value="${otherVal}"
                 oninput="updateIdDisplay()" />
        </div>
      </div>`;
    }

    if (f.type === 'select') {
      const opts = (f.options || []).map(o =>
        `<option${o === val ? ' selected' : ''}>${o}</option>`
      ).join('');
      return `<div class="${cls}" id="fg-${f.key}">
        <label for="rv-${f.key}">${f.label}${reqStar}${badge}</label>
        <select id="rv-${f.key}" class="form-control"><option value=""></option>${opts}</select>
      </div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="${cls}" id="fg-${f.key}">
        <label for="rv-${f.key}">${f.label}${reqStar}${badge}</label>
        <textarea id="rv-${f.key}" class="form-control">${escHtml(val)}</textarea>
      </div>`;
    }
    const ph = f.placeholder ? ` placeholder="${f.placeholder}"` : '';
    const onInput = f.key === 'colour' ? ' oninput="updateIdDisplay()"' : '';
    return `<div class="${cls}" id="fg-${f.key}">
      <label for="rv-${f.key}">${f.label}${reqStar}${badge}</label>
      <input type="text" id="rv-${f.key}" class="form-control" value="${escAttr(val)}"${ph}${onInput} />
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

function onCategoryChange() {
  const sel  = document.getElementById('rv-category');
  const wrap = document.getElementById('rv-category-other-wrap');
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === 'other' ? '' : 'none';
  if (sel.value === 'other') document.getElementById('rv-category-other')?.focus();
  updateIdDisplay();
}

function getSelectedCatCode() {
  const sel = document.getElementById('rv-category');
  if (!sel) return null;
  const catName = sel.value === 'other'
    ? (document.getElementById('rv-category-other')?.value.trim() || '')
    : sel.value;
  if (!catName) return null;
  const cat = currentCategories.find(c => c.name === catName);
  return cat ? cat.code : catName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
}

function buildBaseId(catCode) {
  // Backend base ID is always JSH-{CODE}-{8DIGITS}
  const parts = (currentDraft.id || '').split('-');
  const seqNum = parts[2] || '';
  return catCode && seqNum ? `JSH-${catCode}-${seqNum}` : (currentDraft.id || '');
}

function updateIdDisplay() {
  const catCode   = getSelectedCatCode();
  const newBaseId = buildBaseId(catCode);
  const colour    = (document.getElementById('rv-colour')?.value || '').trim();
  const colourCode = colour.toUpperCase().replace(/\s+/g, '-');
  const displayId  = colourCode ? `${newBaseId}-${colourCode}` : newBaseId;
  const el = document.getElementById('review-id-display');
  if (el) el.value = displayId;
}

function getReviewDraft() {
  const draft = { ...currentDraft };

  REVIEW_FIELDS.forEach(f => {
    const el = document.getElementById(`rv-${f.key}`);
    if (el) draft[f.key] = el.value.trim() || null;
  });

  if (document.getElementById('rv-category')?.value === 'other') {
    draft.category = document.getElementById('rv-category-other')?.value.trim() || null;
  }

  const name       = draft.name || '';
  const category   = draft.category || '';
  const colour     = draft.colour || '';
  const catCode    = getSelectedCatCode();
  const baseId     = buildBaseId(catCode) || slugify(name) || 'new-product';
  const colourCode = colour.toUpperCase().replace(/\s+/g, '-');
  const productId  = colourCode ? `${baseId}-${colourCode}` : baseId;

  draft.id           = productId;
  draft.slug         = slugify(name) || 'new-product';
  draft.categorySlug = slugify(category);
  draft.images       = Array.from({ length: selectedPhotos.length },
                         (_, i) => `images/products/${productId.toLowerCase()}-${i + 1}.jpg`);

  if (name) {
    const suffix = name.toLowerCase().includes('saree') ? '' : ' saree';
    draft.whatsappMessage = `Hi, I'm interested in the ${name}${suffix}. Could you share more details and pricing?`;
  } else {
    draft.whatsappMessage = "Hi, I saw one of your sarees and I'm interested. Could you share more details and pricing?";
  }

  return draft;
}

async function submitConfirm() {
  const missing = REVIEW_FIELDS.filter(f => {
    if (!f.required) return false;
    if (f.key === 'category') {
      const sel = document.getElementById('rv-category');
      if (!sel || !sel.value) return true;
      if (sel.value === 'other') {
        const other = document.getElementById('rv-category-other');
        return !other || !other.value.trim();
      }
      return false;
    }
    const el = document.getElementById(`rv-${f.key}`);
    return !el || !el.value.trim();
  });

  if (missing.length > 0) {
    missing.forEach(f => {
      document.getElementById(`fg-${f.key}`)?.classList.add('field-error');
    });
    showError('confirm-error', `Please fill in: ${missing.map(f => f.label).join(', ')}`);
    return;
  }

  REVIEW_FIELDS.forEach(f => {
    document.getElementById(`fg-${f.key}`)?.classList.remove('field-error');
  });

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

// ── Products list ─────────────────────────────────────────────────────────────
async function loadManage() {
  const f = id => document.getElementById(id);
  f('products-loading').classList.remove('hidden');
  f('products-content').classList.add('hidden');
  f('products-empty').classList.add('hidden');
  f('products-fetch-error').classList.add('hidden');

  try {
    const res  = await fetch(`${API}/products`, { headers: { 'x-token': token() } });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('products-fetch-error', data.detail || 'Could not load products.');
      return;
    }

    const rawProducts  = data.all || [];
    const stillPending = cleanPendingDeletes(rawProducts);
    allProducts        = rawProducts.filter(p => !stillPending.includes(p.id));
    imageBase          = data.imageBase || '';
    currentCategories  = data.categories || [];
    origLiveIds = new Set((data.liveIds || []).filter(id => !stillPending.includes(id)));
    origFeatIds = new Set(allProducts.filter(p => p.isFeatured).map(p => p.id));
    curLiveIds  = new Set(origLiveIds);
    curFeatIds  = new Set(origFeatIds);

    f('products-loading').classList.add('hidden');

    if (allProducts.length === 0) {
      f('products-empty').classList.remove('hidden');
      return;
    }

    renderProductList();
    const n = allProducts.length;
    f('products-count').textContent = `${n} product${n === 1 ? '' : 's'} in catalog`;
    f('products-content').classList.remove('hidden');
    updateSaveBtn();
    hideMsg('manage-save-success');
    hideMsg('manage-save-error');
  } catch {
    f('products-loading').classList.add('hidden');
    showError('products-fetch-error', 'Could not reach the server. Please check your connection.');
  }
}

function renderProductList() {
  document.getElementById('product-list').innerHTML = allProducts.map((p, i) => {
    const live    = curLiveIds.has(p.id);
    const feat    = curFeatIds.has(p.id);
    const meta    = [p.category, p.colour].filter(Boolean).join(' · ') || '—';
    const imgPath = p.images && p.images[0];
    const imgSrc  = imgPath
      ? (imgPath.startsWith('http') ? imgPath : `${imageBase}/${imgPath}`)
      : '';
    const imgHtml = imgSrc
      ? `<img class="product-card-img" src="${imgSrc}" alt="${escAttr(p.name || '')}"
             onclick="openImageModal(${i})" style="cursor:pointer" />`
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
          <button class="delete-btn" onclick="openProductDeleteModal('${escAttr(p.id)}', '${escAttr(p.name || p.id)}')" aria-label="Delete product">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
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

// ── Categories tab ────────────────────────────────────────────────────────────
async function loadCategories() {
  const f = id => document.getElementById(id);
  f('categories-loading').classList.remove('hidden');
  f('categories-content').classList.add('hidden');
  f('categories-fetch-error').classList.add('hidden');

  try {
    const res  = await fetch(`${API}/categories`, { headers: { 'x-token': token() } });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('categories-fetch-error', data.detail || 'Could not load categories.');
      return;
    }

    const rawCategories = data.categories || [];
    const stillPending  = cleanPendingCategoryDeletes(rawCategories);
    allCategories = rawCategories.filter(c => !stillPending.includes(c.code));

    f('categories-loading').classList.add('hidden');
    renderCategoryList();
    const n = allCategories.length;
    f('categories-count').textContent = `${n} categor${n === 1 ? 'y' : 'ies'}`;
    f('categories-content').classList.remove('hidden');
    hideAddCategoryForm();
    hideMsg('add-category-success');
  } catch {
    f('categories-loading').classList.add('hidden');
    showError('categories-fetch-error', 'Could not reach the server. Please check your connection.');
  }
}

function renderCategoryList() {
  document.getElementById('category-list').innerHTML = allCategories.map(c => `
    <div class="category-card">
      <div class="category-card-info">
        <p class="category-card-name">${escHtml(c.name)}</p>
        <p class="category-card-meta">Code: ${escHtml(c.code)} &middot; ${escHtml(c.slug)}</p>
      </div>
      <button class="delete-btn" onclick="openCategoryDeleteModal('${escAttr(c.code)}', '${escAttr(c.name)}')" aria-label="Delete category">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`).join('');
}

function showAddCategoryForm() {
  document.getElementById('add-category-panel').classList.remove('hidden');
  document.getElementById('new-category-name').focus();
  hideMsg('add-category-error');
}

function hideAddCategoryForm() {
  document.getElementById('add-category-panel').classList.add('hidden');
  document.getElementById('new-category-name').value = '';
  hideMsg('add-category-error');
}

async function submitAddCategory() {
  const name = document.getElementById('new-category-name').value.trim();
  if (!name) {
    showError('add-category-error', 'Please enter a category name.');
    return;
  }

  const btn = document.getElementById('add-category-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating PR…';
  hideMsg('add-category-error');
  hideMsg('add-category-success');

  try {
    const res  = await fetch(`${API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token() },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('add-category-error', data.detail || 'Could not add category. Please try again.');
    } else {
      allCategories.push(data.category);
      renderCategoryList();
      const n = allCategories.length;
      document.getElementById('categories-count').textContent = `${n} categor${n === 1 ? 'y' : 'ies'}`;
      hideAddCategoryForm();
      const el = document.getElementById('add-category-success');
      el.innerHTML = `Category added. <a href="${data.pr_url}" target="_blank" class="pr-link">View PR &rarr;</a>`;
      el.classList.remove('hidden');
    }
  } catch {
    showError('add-category-error', 'Could not reach the server. Please check your connection.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit & create PR';
  }
}

// ── Delete modal (generic for products and categories) ────────────────────────
let pendingDelete = null;

function openProductDeleteModal(id, name) {
  pendingDelete = { type: 'product', id, name };
  document.getElementById('delete-modal-title').textContent = 'Delete product?';
  document.getElementById('delete-modal-name').textContent  = name;
  document.getElementById('delete-modal-warn').textContent  =
    "This will raise a PR to permanently remove it from your catalog. If it's live, it will be taken off the site too.";
  _openDeleteModal();
}

function openCategoryDeleteModal(code, name) {
  pendingDelete = { type: 'category', code, name };
  document.getElementById('delete-modal-title').textContent = 'Delete category?';
  document.getElementById('delete-modal-name').textContent  = name;
  document.getElementById('delete-modal-warn').textContent  =
    "This will raise a PR to remove this category. Cannot delete if any products are using it.";
  _openDeleteModal();
}

function _openDeleteModal() {
  hideMsg('delete-modal-error');
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled    = false;
  btn.textContent = 'Yes, delete';
  document.getElementById('delete-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  document.body.style.overflow = '';
  pendingDelete = null;
}

function handleDeleteOverlayClick(e) {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
}

async function confirmDelete() {
  if (!pendingDelete) return;
  if (pendingDelete.type === 'product')  await doDeleteProduct(pendingDelete.id);
  if (pendingDelete.type === 'category') await doDeleteCategory(pendingDelete.code);
}

async function doDeleteProduct(id) {
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating PR…';
  hideMsg('delete-modal-error');

  try {
    const res  = await fetch(`${API}/product/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-token': token() },
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('delete-modal-error', data.detail || 'Could not delete product. Please try again.');
      btn.disabled    = false;
      btn.textContent = 'Yes, delete';
    } else {
      closeDeleteModal();
      addPendingDelete(id);
      allProducts = allProducts.filter(p => p.id !== id);
      origLiveIds.delete(id); origFeatIds.delete(id);
      curLiveIds.delete(id);  curFeatIds.delete(id);
      renderProductList();
      const n = allProducts.length;
      if (n === 0) {
        document.getElementById('products-content').classList.add('hidden');
        document.getElementById('products-empty').classList.remove('hidden');
      } else {
        document.getElementById('products-count').textContent = `${n} product${n === 1 ? '' : 's'} in catalog`;
      }
      updateSaveBtn();
      const el = document.getElementById('manage-save-success');
      el.innerHTML = `Product deleted. <a href="${data.pr_url}" target="_blank" class="pr-link">View PR &rarr;</a>`;
      el.classList.remove('hidden');
    }
  } catch {
    showError('delete-modal-error', 'Could not reach the server. Please check your connection.');
    btn.disabled    = false;
    btn.textContent = 'Yes, delete';
  }
}

async function doDeleteCategory(code) {
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating PR…';
  hideMsg('delete-modal-error');

  try {
    const res  = await fetch(`${API}/category/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: { 'x-token': token() },
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { logout(); return; }
      showError('delete-modal-error', data.detail || 'Could not delete category.');
      btn.disabled    = false;
      btn.textContent = 'Yes, delete';
    } else {
      closeDeleteModal();
      addPendingCategoryDelete(code);
      allCategories = allCategories.filter(c => c.code !== code);
      renderCategoryList();
      const n = allCategories.length;
      document.getElementById('categories-count').textContent = `${n} categor${n === 1 ? 'y' : 'ies'}`;
      const el = document.getElementById('add-category-success');
      el.innerHTML = `Category deleted. <a href="${data.pr_url}" target="_blank" class="pr-link">View PR &rarr;</a>`;
      el.classList.remove('hidden');
    }
  } catch {
    showError('delete-modal-error', 'Could not reach the server. Please check your connection.');
    btn.disabled    = false;
    btn.textContent = 'Yes, delete';
  }
}

// ── Image modal ───────────────────────────────────────────────────────────────
let modalImages = [];
let modalIndex  = 0;

function openImageModal(productIdx) {
  const p = allProducts[productIdx];
  if (!p || !p.images || p.images.length === 0) return;
  modalImages = p.images.map(img =>
    img.startsWith('http') ? img : `${imageBase}/${img}`
  );
  modalIndex = 0;
  renderModal();
  document.getElementById('image-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  document.getElementById('image-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('image-modal')) closeImageModal();
}

function modalNav(dir) {
  modalIndex = (modalIndex + dir + modalImages.length) % modalImages.length;
  renderModal();
}

function modalGoto(idx) {
  modalIndex = idx;
  renderModal();
}

function renderModal() {
  document.getElementById('modal-main-img').src = modalImages[modalIndex];
  document.getElementById('modal-counter').textContent = `${modalIndex + 1} / ${modalImages.length}`;

  const nav = document.getElementById('modal-nav');
  nav.style.display = modalImages.length > 1 ? 'flex' : 'none';

  document.getElementById('modal-thumbs').innerHTML = modalImages.length > 1
    ? modalImages.map((url, i) =>
        `<img class="modal-thumb${i === modalIndex ? ' active' : ''}"
              src="${url}" onclick="modalGoto(${i})" alt="Photo ${i + 1}" />`
      ).join('')
    : '';
}

// close modals on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeImageModal(); closeDeleteModal(); }
});

// ── Pending deletes ───────────────────────────────────────────────────────────
const DELETE_TTL = 24 * 60 * 60 * 1000;

function addPendingDelete(id) {
  try {
    const raw = JSON.parse(localStorage.getItem('pendingDeletes') || '[]');
    const now = Date.now();
    const rest = raw.filter(e => e.expiry > now && e.id !== id);
    rest.push({ id, expiry: now + DELETE_TTL });
    localStorage.setItem('pendingDeletes', JSON.stringify(rest));
  } catch {}
}

function cleanPendingDeletes(loadedProducts) {
  try {
    const now = Date.now();
    const raw = JSON.parse(localStorage.getItem('pendingDeletes') || '[]');
    const loadedIds = new Set(loadedProducts.map(p => p.id));
    const stillPending = raw.filter(e => e.expiry > now && loadedIds.has(e.id));
    localStorage.setItem('pendingDeletes', JSON.stringify(stillPending));
    return stillPending.map(e => e.id);
  } catch { return []; }
}

function addPendingCategoryDelete(code) {
  try {
    const raw = JSON.parse(localStorage.getItem('pendingCategoryDeletes') || '[]');
    const now = Date.now();
    const rest = raw.filter(e => e.expiry > now && e.code !== code);
    rest.push({ code, expiry: now + DELETE_TTL });
    localStorage.setItem('pendingCategoryDeletes', JSON.stringify(rest));
  } catch {}
}

function cleanPendingCategoryDeletes(loadedCategories) {
  try {
    const now = Date.now();
    const raw = JSON.parse(localStorage.getItem('pendingCategoryDeletes') || '[]');
    const loadedCodes = new Set(loadedCategories.map(c => c.code));
    const stillPending = raw.filter(e => e.expiry > now && loadedCodes.has(e.code));
    localStorage.setItem('pendingCategoryDeletes', JSON.stringify(stillPending));
    return stillPending.map(e => e.code);
  } catch { return []; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function token() { return localStorage.getItem('token') || ''; }

function slugify(text) {
  return (text || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
