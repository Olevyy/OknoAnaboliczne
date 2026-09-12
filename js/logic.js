// Czyste funkcje: bez DOM i bez localStorage, więc da się je testować w Node.

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const GOAL_TYPES = {
  bulk: 'Masa',
  maintain: 'Utrzymanie',
  cut: 'Redukcja',
};

export const DEFAULT_SETTINGS = {
  theme: 'system',
  windowHours: 3,
  windowLimit: 50,
  goalMode: 'auto',
  manualGoal: 160,
  weight: 80,
  goalType: 'maintain',
  gPerKg: { bulk: 1.8, maintain: 1.6, cut: 2.2 },
};

const pad = (n) => String(n).padStart(2, '0');

export function sum(entries) {
  return entries.reduce((acc, e) => acc + e.grams, 0);
}

export function round1(x) {
  return Math.round(x * 10) / 10;
}

/** Wpisy w oknie kończącym się w chwili `at`: ts ∈ (at − H, at]. */
export function entriesInWindow(entries, at, hours) {
  const from = at - hours * HOUR;
  return entries.filter((e) => e.ts > from && e.ts <= at);
}

/**
 * Stan kroczącego okna w chwili `now`.
 * releases: kolejne momenty, w których "available" realnie rośnie.
 */
export function windowStatus(entries, now, { windowHours, windowLimit }) {
  const inWindow = entriesInWindow(entries, now, windowHours).sort((a, b) => a.ts - b.ts);
  const used = round1(sum(inWindow));
  const available = round1(Math.max(0, windowLimit - used));
  const over = round1(Math.max(0, used - windowLimit));

  const releases = [];
  let remaining = used;
  let lastAvailable = available;
  for (let i = 0; i < inWindow.length; i++) {
    const e = inWindow[i];
    remaining -= e.grams;
    const at = e.ts + windowHours * HOUR;
    // wpisy wypadające w tej samej chwili łączymy
    if (i + 1 < inWindow.length && inWindow[i + 1].ts === e.ts) continue;
    const avail = round1(Math.max(0, windowLimit - remaining));
    if (avail > lastAvailable) {
      releases.push({ at, available: avail });
      lastAvailable = avail;
    }
  }

  return { used, available, over, limit: windowLimit, entries: inWindow, releases };
}

/**
 * Największa nadwyżka ponad limit w dowolnym oknie zawierającym wpis `entry`,
 * liczona po dodaniu wpisu. Działa też dla wpisów dodanych wstecz.
 * `entries` nie powinno zawierać `entry` (przy edycji wyklucz stary wpis).
 */
export function overflowFor(entries, entry, { windowHours, windowLimit }) {
  const all = [...entries, entry];
  const end = entry.ts + windowHours * HOUR;
  const checkpoints = all.filter((e) => e.ts >= entry.ts && e.ts < end).map((e) => e.ts);
  let worst = 0;
  for (const t of checkpoints) {
    const used = sum(entriesInWindow(all, t, windowHours));
    worst = Math.max(worst, used - windowLimit);
  }
  return round1(Math.max(0, worst));
}

export function dailyGoal(settings) {
  if (settings.goalMode === 'manual') return Math.round(settings.manualGoal) || 0;
  const perKg = settings.gPerKg?.[settings.goalType] ?? 0;
  return Math.round((settings.weight || 0) * perKg);
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function entriesForDay(entries, ts) {
  const key = dayKey(ts);
  return entries.filter((e) => dayKey(e.ts) === key);
}

/** Ostatnie `days` dni (od dziś wstecz): [{ key, ts, total, entries }]. */
export function dayHistory(entries, now, days) {
  const byKey = new Map();
  for (const e of entries) {
    const k = dayKey(e.ts);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  const out = [];
  const d = new Date(startOfDay(now));
  for (let i = 0; i < days; i++) {
    const key = dayKey(d.getTime());
    const list = (byKey.get(key) || []).sort((a, b) => a.ts - b.ts);
    out.push({ key, ts: d.getTime(), total: round1(sum(list)), entries: list });
    d.setDate(d.getDate() - 1);
  }
  return out;
}

/**
 * "HH:MM" → timestamp dzisiaj o tej godzinie. Jeśli to późniejsza godzina
 * niż teraz, chodzi o wczoraj (zapomniany wieczorny posiłek).
 */
export function timeInputToTs(hhmm, now) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() > now + MIN) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export function toTimeInput(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Ta sama data co `baseTs`, nowa godzina. */
export function withTime(baseTs, hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return baseTs;
  const d = new Date(baseTs);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.ceil(ms / MIN));
  if (totalMin < 1) return '< 1 min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatGrams(g) {
  return round1(g).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
}

export function parseGrams(str) {
  const n = Number(String(str ?? '').replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? round1(n) : null;
}
