import { DEFAULT_SETTINGS, round1 } from './logic.js';

const KEY = 'oknoAnaboliczne.v1';
const listeners = new Set();

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  settings.gPerKg = { ...DEFAULT_SETTINGS.gPerKg, ...(data.settings?.gPerKg || {}) };
  return {
    version: 1,
    entries: Array.isArray(data.entries)
      ? data.entries.filter((e) => Number.isFinite(e?.ts) && e.grams > 0)
      : [],
    products: Array.isArray(data.products)
      ? data.products.filter((p) => p?.name && p.grams > 0)
      : [],
    settings,
  };
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return normalize(null);
  }
}

export const state = load();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Nie udało się zapisać danych', err);
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
}

// ---- wpisy ----
export function addEntry({ grams, ts, name = '', productId = null }) {
  const entry = { id: uid(), ts, grams: round1(grams), name: name.trim(), productId };
  state.entries.push(entry);
  if (productId) {
    const p = state.products.find((x) => x.id === productId);
    if (p) {
      p.uses = (p.uses || 0) + 1;
      p.lastUsed = Date.now();
    }
  }
  commit();
  return entry;
}

export function updateEntry(id, patch) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, patch, patch.grams != null ? { grams: round1(patch.grams) } : {});
  commit();
}

export function removeEntry(id) {
  const i = state.entries.findIndex((x) => x.id === id);
  if (i === -1) return null;
  const [removed] = state.entries.splice(i, 1);
  commit();
  return removed;
}

export function restoreEntry(entry) {
  state.entries.push(entry);
  commit();
}

// ---- produkty ----
export function sortedProducts() {
  return [...state.products].sort(
    (a, b) => (b.uses || 0) - (a.uses || 0) || (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name, 'pl'),
  );
}

export function addProduct({ name, grams }) {
  const existing = state.products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    existing.grams = round1(grams);
    commit();
    return existing;
  }
  const product = { id: uid(), name: name.trim(), grams: round1(grams), uses: 0, lastUsed: 0 };
  state.products.push(product);
  commit();
  return product;
}

export function updateProduct(id, patch) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch);
  commit();
}

export function removeProduct(id) {
  const removed = state.products.find((p) => p.id === id) || null;
  state.products = state.products.filter((p) => p.id !== id);
  commit();
  return removed;
}

export function restoreProduct(product) {
  state.products.push(product);
  commit();
}

export function undoProductUse(id) {
  const p = state.products.find((x) => x.id === id);
  if (p && p.uses > 0) p.uses -= 1;
}

// ---- ustawienia ----
export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  commit();
}

// ---- dane ----
export function exportJson() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.entries)) throw new Error('To nie jest plik kopii Okna Anabolicznego.');
  const next = normalize(parsed);
  state.entries = next.entries;
  state.products = next.products;
  state.settings = next.settings;
  commit();
}

export function clearAll() {
  const next = normalize(null);
  state.entries = next.entries;
  state.products = next.products;
  state.settings = next.settings;
  commit();
}
