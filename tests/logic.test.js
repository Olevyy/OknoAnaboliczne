import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR, MIN, windowStatus, overflowFor, dailyGoal, dayHistory,
  timeInputToTs, formatDuration, parseGrams, DEFAULT_SETTINGS,
} from '../js/logic.js';

const cfg = { windowHours: 3, windowLimit: 50 };
const now = new Date(2026, 8, 12, 15, 0).getTime();
const e = (minAgo, grams) => ({ id: String(Math.random()), ts: now - minAgo * MIN, grams });

test('puste okno: cały limit dostępny', () => {
  const s = windowStatus([], now, cfg);
  assert.equal(s.used, 0);
  assert.equal(s.available, 50);
  assert.deepEqual(s.releases, []);
});

test('wpisy starsze niż okno są pomijane', () => {
  const s = windowStatus([e(181, 40), e(60, 20)], now, cfg);
  assert.equal(s.used, 20);
  assert.equal(s.available, 30);
});

test('harmonogram zwolnień przy przekroczeniu pomija momenty bez realnego zysku', () => {
  // 30 g 150 min temu (wypada za 30 min), 40 g 60 min temu (wypada za 120 min)
  const s = windowStatus([e(150, 30), e(60, 40)], now, cfg);
  assert.equal(s.used, 70);
  assert.equal(s.over, 20);
  assert.equal(s.available, 0);
  assert.equal(s.releases.length, 2);
  assert.equal(s.releases[0].at, now + 30 * MIN);
  assert.equal(s.releases[0].available, 10);
  assert.equal(s.releases[1].available, 50);
});

test('zwolnienie, które nie zmienia dostępności, nie jest pokazywane', () => {
  // 10 g wypada pierwsze, ale nadal jesteśmy powyżej limitu
  const s = windowStatus([e(170, 10), e(100, 60)], now, cfg);
  assert.equal(s.releases.length, 1);
  assert.equal(s.releases[0].available, 50);
});

test('overflow liczy nadwyżkę także dla wpisu wstecz', () => {
  const existing = [e(30, 40)];
  // wpis sprzed 60 min, 20 g: okno kończące się 30 min temu ma 60 g
  assert.equal(overflowFor(existing, e(60, 20), cfg), 10);
  // wpis sprzed 4 h nie nachodzi na 40 g
  assert.equal(overflowFor(existing, e(240, 45), cfg), 0);
});

test('cel dzienny: ręczny i automatyczny', () => {
  assert.equal(dailyGoal({ ...DEFAULT_SETTINGS, goalMode: 'manual', manualGoal: 150 }), 150);
  assert.equal(dailyGoal({ ...DEFAULT_SETTINGS, weight: 80, goalType: 'cut' }), 176);
});

test('historia grupuje po dniach', () => {
  const yesterday = now - 24 * HOUR;
  const h = dayHistory([{ ts: now, grams: 30 }, { ts: yesterday, grams: 25 }, { ts: yesterday + MIN, grams: 5 }], now, 3);
  assert.equal(h.length, 3);
  assert.equal(h[0].total, 30);
  assert.equal(h[1].total, 30);
  assert.equal(h[2].total, 0);
});

test('godzina z przyszłości oznacza wczoraj', () => {
  const past = timeInputToTs('14:20', now);
  assert.equal(past, now - 40 * MIN);
  const future = timeInputToTs('23:30', now);
  assert.equal(future, new Date(2026, 8, 11, 23, 30).getTime());
});

test('formatowanie i parsowanie', () => {
  assert.equal(formatDuration(75 * MIN), '1 h 15 min');
  assert.equal(formatDuration(30 * MIN), '30 min');
  assert.equal(parseGrams('12,5'), 12.5);
  assert.equal(parseGrams('0'), null);
  assert.equal(parseGrams('abc'), null);
});
