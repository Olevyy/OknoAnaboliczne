import * as L from './logic.js';
import * as S from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const g = (x) => `${L.formatGrams(x)} g`;
const RING_CIRC = 2 * Math.PI * 52;

function plural(n, one, few, many) {
  if (n === 1) return one;
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? few : many;
}

function dayLabel(ts, now) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (L.dayKey(ts) === L.dayKey(now)) return 'Dziś';
  if (L.dayKey(ts) === L.dayKey(yesterday.getTime())) return 'Wczoraj';
  return new Date(ts).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function entryLabel(e) {
  return e.name || 'Białko';
}

// ================= MOTYW =================
const darkMedia = matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const t = S.state.settings.theme;
  document.documentElement.dataset.theme = t === 'system' ? (darkMedia.matches ? 'dark' : 'light') : t;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  $('meta[name="theme-color"]').setAttribute('content', bg);
}
darkMedia.addEventListener('change', applyTheme);

// ================= NAWIGACJA =================
let currentView = 'today';

function showView(view) {
  currentView = view;
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === view));
  $('#fab-add').hidden = view === 'settings';
  if (view === 'settings') renderSettings({ inputs: true });
  else render();
  window.scrollTo(0, 0);
}

$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.tab)));

// ================= TOAST =================
let toastTimer;

function toast(text, { action, onAction, warn = false, duration = 4500 } = {}) {
  const el = $('#toast');
  const btn = $('#toast-action');
  $('#toast-text').textContent = text;
  el.classList.toggle('warn', warn);
  btn.hidden = !action;
  btn.textContent = action || '';
  btn.onclick = () => {
    el.hidden = true;
    onAction?.();
  };
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), duration);
}

// ================= DZIŚ =================
function renderToday() {
  const now = Date.now();
  const st = S.state.settings;
  const w = L.windowStatus(S.state.entries, now, st);

  $('#today-date').textContent = new Date(now).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

  // okno
  $('#win-used').textContent = L.formatGrams(w.used);
  $('#win-limit').textContent = L.formatGrams(st.windowLimit);
  $('#win-hours').textContent = L.formatGrams(st.windowHours);
  const ring = $('#ring-fill');
  ring.style.strokeDashoffset = RING_CIRC * (1 - Math.min(1, w.used / st.windowLimit));
  ring.classList.toggle('over', w.over > 0);

  const avail = $('#win-available');
  avail.textContent = g(w.available);
  avail.classList.toggle('zero', w.available === 0);

  const status = $('#win-status');
  const first = w.releases[0];
  const last = w.releases[w.releases.length - 1];
  status.classList.toggle('over', w.over > 0);
  if (w.used === 0) {
    status.textContent = 'Okno jest puste.';
  } else if (w.over > 0) {
    status.textContent = `${g(w.over)} ponad limit · więcej za ${L.formatDuration(first.at - now)}`;
  } else if (w.available === 0) {
    status.textContent = `Okno pełne · więcej za ${L.formatDuration(first.at - now)}`;
  } else {
    status.textContent = `Pełny limit za ${L.formatDuration(last.at - now)}`;
  }

  $('#win-releases').innerHTML = w.releases
    .slice(0, 4)
    .map((r) => `<li><b>${L.toTimeInput(r.at)}</b> → ${g(r.available)}</li>`)
    .join('');

  // dzień
  const todayEntries = L.entriesForDay(S.state.entries, now).sort((a, b) => b.ts - a.ts);
  const total = L.round1(L.sum(todayEntries));
  const goal = L.dailyGoal(st);
  $('#day-total').textContent = L.formatGrams(total);
  $('#day-goal').textContent = goal || '–';
  const pct = goal ? Math.round((total / goal) * 100) : 0;
  const bar = $('#day-bar');
  bar.style.width = `${Math.min(100, pct)}%`;
  bar.classList.toggle('done', goal > 0 && total >= goal);

  const left = L.round1(goal - total);
  if (!goal) {
    $('#day-left').textContent = 'Ustaw cel dzienny w ustawieniach.';
  } else if (left > 0) {
    const meals = Math.ceil(left / st.windowLimit);
    $('#day-left').textContent = `Zostało ${g(left)} (${pct}%), czyli min. ${meals} ${plural(meals, 'posiłek', 'posiłki', 'posiłków')} po ≤ ${g(st.windowLimit)}`;
  } else {
    $('#day-left').textContent = `Cel osiągnięty! (${pct}%)`;
  }

  // produkty
  const products = S.sortedProducts();
  $('#quick-products').innerHTML = products.length
    ? products
        .map((p) => `<button class="product" data-product="${p.id}"><span class="p-g">${g(p.grams)}</span><span class="p-name">${esc(p.name)}</span></button>`)
        .join('')
    : '<div class="empty">Brak produktów. Dodaj wpis z nazwą i zaznacz „Zapisz jako produkt”.</div>';

  // wpisy
  const inWindow = new Set(w.entries.map((e) => e.id));
  $('#today-entries').innerHTML = todayEntries.length
    ? todayEntries.map((e) => entryItem(e, inWindow.has(e.id))).join('')
    : '<li class="empty center">Brak wpisów. Dotknij +, żeby dodać białko.</li>';
}

function entryItem(e, inWindow) {
  return `<li><button class="entry" data-entry="${e.id}">
    <span class="dot ${inWindow ? 'in' : ''}"></span>
    <span class="entry-time">${L.toTimeInput(e.ts)}</span>
    <span class="entry-name">${esc(entryLabel(e))}</span>
    <span class="entry-g">${g(e.grams)}</span>
  </button></li>`;
}

$('#quick-products').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-product]');
  if (!btn) return;
  const p = S.state.products.find((x) => x.id === btn.dataset.product);
  if (!p) return;
  const ts = Date.now();
  const over = L.overflowFor(S.state.entries, { ts, grams: p.grams }, S.state.settings);
  const entry = S.addEntry({ grams: p.grams, ts, name: p.name, productId: p.id });
  navigator.vibrate?.(15);
  toast(over > 0 ? `${p.name}: +${g(p.grams)}, ${g(over)} ponad limit okna` : `${p.name}: +${g(p.grams)}`, {
    warn: over > 0,
    action: 'Cofnij',
    onAction: () => {
      S.undoProductUse(p.id);
      S.removeEntry(entry.id);
    },
  });
});

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-entry]');
  if (btn) openEditEntry(btn.dataset.entry);
});

// ================= HISTORIA =================
const openDays = new Set();

function renderHistory() {
  const now = Date.now();
  const goal = L.dailyGoal(S.state.settings);
  const days = L.dayHistory(S.state.entries, now, 30);

  const past7 = days.slice(1, 8);
  const avg7 = L.round1(past7.reduce((a, d) => a + d.total, 0) / 7);
  const withEntries = days.filter((d) => d.entries.length);
  const reached = goal ? withEntries.filter((d) => d.total >= goal).length : 0;
  const best = withEntries.reduce((m, d) => Math.max(m, d.total), 0);

  $('#history-stats').innerHTML = `
    <div><b>${L.formatGrams(avg7)}</b><span class="muted small">śr. 7 dni</span></div>
    <div><b>${reached}/${withEntries.length}</b><span class="muted small">cel osiągnięty</span></div>
    <div><b>${L.formatGrams(best)}</b><span class="muted small">rekord (g)</span></div>`;

  const visible = days.filter((d, i) => i === 0 || d.entries.length);
  if (visible.length === 1 && !visible[0].entries.length) {
    $('#history-list').innerHTML = '<div class="empty center">Brak wpisów z ostatnich 30 dni.</div>';
    return;
  }

  $('#history-list').innerHTML = visible
    .map((d) => {
      const pct = goal ? Math.round((d.total / goal) * 100) : 0;
      const has = d.entries.length > 0;
      return `<details class="day ${has ? '' : 'no-entries'}" data-day="${d.key}" ${openDays.has(d.key) ? 'open' : ''}>
        <summary>
          <div class="day-row">
            <strong>${dayLabel(d.ts, now)}</strong>
            <span>${g(d.total)} <span class="pct">${goal ? `· ${pct}%` : ''}</span></span>
          </div>
          <div class="bar"><div class="bar-fill ${goal && d.total >= goal ? 'done' : ''}" style="width:${Math.min(100, pct)}%"></div></div>
        </summary>
        ${has ? `<ul class="entries">${d.entries.map((e) => entryItem(e, false)).join('')}</ul>` : ''}
      </details>`;
    })
    .join('');
}

$('#history-list').addEventListener('toggle', (ev) => {
  const d = ev.target.closest('[data-day]');
  if (!d) return;
  if (d.open) openDays.add(d.dataset.day);
  else openDays.delete(d.dataset.day);
}, true);

// ================= ARKUSZ WPISU =================
const sheet = $('#entry-sheet');
const f = {
  grams: $('#entry-grams'),
  name: $('#entry-name'),
  time: $('#entry-time'),
  when: $('#entry-when'),
  saveProduct: $('#entry-save-product'),
  saveRow: $('#save-product-row'),
  preview: $('#entry-preview'),
  submit: $('#entry-submit'),
  del: $('#entry-delete'),
  products: $('#sheet-products'),
  timeChips: $('#time-chips'),
};
const draft = { mode: 'add', id: null, productId: null, ago: 0, baseTs: 0 };

function openAddEntry() {
  Object.assign(draft, { mode: 'add', id: null, productId: null, ago: 0, baseTs: 0 });
  $('#entry-title').textContent = 'Dodaj białko';
  f.submit.textContent = 'Dodaj';
  f.del.hidden = true;
  f.grams.value = '';
  f.name.value = '';
  f.saveProduct.checked = false;
  f.time.value = L.toTimeInput(Date.now());
  $$('[data-ago]').forEach((c) => (c.hidden = false));

  const products = S.sortedProducts();
  f.products.innerHTML = products
    .map((p) => `<button type="button" class="chip" data-pick="${p.id}">${esc(p.name)}<b>${L.formatGrams(p.grams)}</b></button>`)
    .join('');

  syncSheet();
  sheet.showModal();
  if (!products.length) f.grams.focus();
}

function openEditEntry(id) {
  const e = S.state.entries.find((x) => x.id === id);
  if (!e) return;
  Object.assign(draft, { mode: 'edit', id, productId: e.productId, ago: null, baseTs: e.ts });
  $('#entry-title').textContent = 'Edytuj wpis';
  f.submit.textContent = 'Zapisz';
  f.del.hidden = false;
  f.grams.value = L.formatGrams(e.grams);
  f.name.value = e.name || '';
  f.saveProduct.checked = false;
  f.time.value = L.toTimeInput(e.ts);
  f.products.innerHTML = '';
  $$('[data-ago]').forEach((c) => (c.hidden = true));
  syncSheet();
  sheet.showModal();
}

function draftTs() {
  const now = Date.now();
  if (draft.mode === 'edit') return L.withTime(draft.baseTs, f.time.value);
  if (draft.ago != null) return now - draft.ago * L.MIN;
  return L.timeInputToTs(f.time.value, now) ?? now;
}

function syncSheet() {
  const now = Date.now();
  const st = S.state.settings;
  const grams = L.parseGrams(f.grams.value);
  const ts = draftTs();

  $$('[data-ago]').forEach((c) => c.classList.toggle('active', draft.ago === Number(c.dataset.ago)));
  $$('[data-pick]').forEach((c) => c.classList.toggle('active', c.dataset.pick === draft.productId));
  f.saveRow.hidden = draft.mode === 'edit' || !!draft.productId;

  const ago = Math.round((now - ts) / L.MIN);
  const time = L.toTimeInput(ts);
  const label = dayLabel(ts, now);
  f.when.textContent = draft.mode === 'add' && L.dayKey(ts) === L.dayKey(now)
    ? (ago <= 0 ? `Dziś, ${time} (teraz)` : `Dziś, ${time} (${L.formatDuration(now - ts)} temu)`)
    : `${label}, ${time}`;

  f.submit.disabled = !grams;
  if (!grams) {
    f.preview.textContent = '';
    f.preview.classList.remove('over');
    return;
  }

  const others = S.state.entries.filter((e) => e.id !== draft.id);
  const candidate = { ts, grams };
  const over = L.overflowFor(others, candidate, st);
  const inCurrent = ts > now - st.windowHours * L.HOUR && ts <= now;
  const usedAfter = L.round1(L.windowStatus(others, now, st).used + (inCurrent ? grams : 0));

  f.preview.classList.toggle('over', over > 0);
  const base = inCurrent
    ? `W oknie po dodaniu: ${g(usedAfter)} / ${g(st.windowLimit)}`
    : 'Wpis poza bieżącym oknem';
  f.preview.textContent = over > 0
    ? `${base}. ${g(over)} ponad limit, lepiej przesunąć część na później.`
    : base;
}

f.grams.addEventListener('input', syncSheet);
f.name.addEventListener('input', () => {
  const p = S.state.products.find((x) => x.id === draft.productId);
  if (draft.mode === 'add' && p && f.name.value.trim() !== p.name) draft.productId = null;
  syncSheet();
});
f.time.addEventListener('input', () => {
  draft.ago = null;
  syncSheet();
});

$('#grams-presets').addEventListener('click', (ev) => {
  const c = ev.target.closest('.chip');
  if (!c) return;
  const current = L.parseGrams(f.grams.value) || 0;
  const next = c.dataset.add ? current + Number(c.dataset.add) : Number(c.dataset.set);
  f.grams.value = L.formatGrams(next);
  syncSheet();
});

f.timeChips.addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-ago]');
  if (!c) return;
  draft.ago = Number(c.dataset.ago);
  f.time.value = L.toTimeInput(Date.now() - draft.ago * L.MIN);
  syncSheet();
});

f.products.addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-pick]');
  if (!c) return;
  const p = S.state.products.find((x) => x.id === c.dataset.pick);
  if (!p) return;
  if (draft.productId === p.id) {
    draft.productId = null;
  } else {
    draft.productId = p.id;
    f.grams.value = L.formatGrams(p.grams);
    f.name.value = p.name;
    f.saveProduct.checked = false;
  }
  syncSheet();
});

$('#entry-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const grams = L.parseGrams(f.grams.value);
  if (!grams) return;
  const name = f.name.value.trim();
  const ts = draftTs();
  const st = S.state.settings;

  if (draft.mode === 'add' && f.saveProduct.checked && !draft.productId) {
    if (!name) {
      toast('Podaj nazwę, żeby zapisać produkt.', { warn: true });
      f.name.focus();
      return;
    }
    draft.productId = S.addProduct({ name, grams }).id;
  }

  const others = S.state.entries.filter((e) => e.id !== draft.id);
  const over = L.overflowFor(others, { ts, grams }, st);

  if (draft.mode === 'edit') {
    S.updateEntry(draft.id, { grams, ts, name });
    sheet.close();
    toast(over > 0 ? `Zapisano, ${g(over)} ponad limit okna` : 'Zapisano zmiany', { warn: over > 0 });
    return;
  }

  const entry = S.addEntry({ grams, ts, name, productId: draft.productId });
  sheet.close();
  navigator.vibrate?.(15);
  toast(over > 0 ? `Dodano ${g(grams)}, ${g(over)} ponad limit okna` : `Dodano ${g(grams)}`, {
    warn: over > 0,
    action: 'Cofnij',
    onAction: () => {
      if (entry.productId) S.undoProductUse(entry.productId);
      S.removeEntry(entry.id);
    },
  });
});

f.del.addEventListener('click', () => {
  const removed = S.removeEntry(draft.id);
  sheet.close();
  if (removed) toast('Usunięto wpis', { action: 'Cofnij', onAction: () => S.restoreEntry(removed) });
});

$('#fab-add').addEventListener('click', openAddEntry);

// wspólne zamykanie arkuszy
$$('dialog.sheet').forEach((d) => {
  d.addEventListener('click', (ev) => {
    if (ev.target === d) d.close();
  });
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
});

// ================= ARKUSZ PRODUKTU =================
const productSheet = $('#product-sheet');
let editingProductId = null;

function openProduct(id = null) {
  editingProductId = id;
  const p = S.state.products.find((x) => x.id === id);
  $('#product-title').textContent = p ? 'Edytuj produkt' : 'Nowy produkt';
  $('#product-name').value = p?.name || '';
  $('#product-grams').value = p ? L.formatGrams(p.grams) : '';
  $('#product-delete').hidden = !p;
  productSheet.showModal();
  if (!p) $('#product-name').focus();
}

$('#product-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = $('#product-name').value.trim();
  const grams = L.parseGrams($('#product-grams').value);
  if (!name || !grams) {
    toast('Podaj nazwę i ilość białka.', { warn: true });
    return;
  }
  if (editingProductId) S.updateProduct(editingProductId, { name, grams });
  else S.addProduct({ name, grams });
  productSheet.close();
});

$('#product-delete').addEventListener('click', () => {
  const removed = S.removeProduct(editingProductId);
  productSheet.close();
  if (removed) toast(`Usunięto „${removed.name}”`, { action: 'Cofnij', onAction: () => S.restoreProduct(removed) });
});

$('#btn-new-product').addEventListener('click', () => openProduct());
$('#manage-products').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-edit-product]');
  if (b) openProduct(b.dataset.editProduct);
});

// ================= USTAWIENIA =================
function renderSettings({ inputs = false } = {}) {
  const st = S.state.settings;
  $$('[data-theme-opt]').forEach((b) => b.classList.toggle('active', b.dataset.themeOpt === st.theme));
  $$('#goal-mode [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === st.goalMode));
  $$('#goal-type [data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === st.goalType));
  $('#goal-auto').hidden = st.goalMode !== 'auto';
  $('#goal-manual').hidden = st.goalMode !== 'manual';
  $('#goal-result').textContent = g(L.dailyGoal(st));

  $('#manage-products').innerHTML = S.sortedProducts()
    .map((p) => `<li><span>${esc(p.name)} · <strong>${g(p.grams)}</strong></span><button data-edit-product="${p.id}">Edytuj</button></li>`)
    .join('') || '<li class="muted small">Brak zapisanych produktów.</li>';

  if (inputs) {
    $('#set-window-hours').value = st.windowHours;
    $('#set-window-limit').value = st.windowLimit;
    $('#set-weight').value = st.weight;
    $('#set-manual-goal').value = st.manualGoal;
    $$('[data-gkg]').forEach((i) => (i.value = st.gPerKg[i.dataset.gkg]));
  }
}

$('#theme-picker').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-theme-opt]');
  if (!b) return;
  S.updateSettings({ theme: b.dataset.themeOpt });
  applyTheme();
});

$('#goal-mode').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-mode]');
  if (b) S.updateSettings({ goalMode: b.dataset.mode });
});

$('#goal-type').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-type]');
  if (b) S.updateSettings({ goalType: b.dataset.type });
});

function bindNumber(sel, key, min, max) {
  $(sel).addEventListener('input', (ev) => {
    const n = Number(ev.target.value.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max) S.updateSettings({ [key]: n });
  });
}
bindNumber('#set-window-hours', 'windowHours', 0.5, 24);
bindNumber('#set-window-limit', 'windowLimit', 1, 500);
bindNumber('#set-weight', 'weight', 20, 400);
bindNumber('#set-manual-goal', 'manualGoal', 1, 1000);

$$('[data-gkg]').forEach((input) =>
  input.addEventListener('input', () => {
    const n = Number(input.value.replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 5) {
      S.updateSettings({ gPerKg: { ...S.state.settings.gPerKg, [input.dataset.gkg]: n } });
    }
  }),
);

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([S.exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `okno-anaboliczne-${L.dayKey(Date.now())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#file-import').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  if (!confirm('Import zastąpi wszystkie obecne dane. Kontynuować?')) return;
  try {
    S.importJson(await file.text());
    applyTheme();
    renderSettings({ inputs: true });
    toast('Zaimportowano dane');
  } catch (err) {
    toast(err.message || 'Nie udało się wczytać pliku', { warn: true });
  }
});

$('#btn-clear').addEventListener('click', () => {
  if (!confirm('Usunąć wszystkie wpisy, produkty i ustawienia? Tego nie da się cofnąć.')) return;
  S.clearAll();
  applyTheme();
  renderSettings({ inputs: true });
  toast('Wyczyszczono dane');
});

// ================= CYKL ŻYCIA =================
function render() {
  if (currentView === 'today') renderToday();
  else if (currentView === 'history') renderHistory();
  else renderSettings();
}

S.subscribe(render);
setInterval(() => {
  if (!document.hidden) {
    render();
    if (sheet.open) syncSheet();
  }
}, 20_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

applyTheme();
render();

if (new URLSearchParams(location.search).has('add')) {
  history.replaceState(null, '', location.pathname);
  openAddEntry();
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
