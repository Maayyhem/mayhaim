// Tests unitaires des formules pures — node --test tests/
const { test } = require('node:test');
const assert = require('node:assert');
const F = require('../shared/formulas.js');

test('gameSensToCm360 — Valorant 0.48 @ 800 DPI ≈ 34.02 cm/360', () => {
  // 2.54 × 360 / (0.48 × 0.07 × 800) = 914.4 / 26.88 = 34.0179
  const cm = F.gameSensToCm360('valorant', 0.48, 800);
  assert.ok(Math.abs(cm - 34.0179) < 0.001, `expected ~34.0179, got ${cm}`);
});

test('gameSensToCm360 — CS2 1.53 @ 800 DPI ≈ 33.96 cm/360', () => {
  const cm = F.gameSensToCm360('cs2', 1.53, 800);
  assert.ok(Math.abs(cm - 33.96) < 0.05, `expected ~33.96, got ${cm}`);
});

test('gameSensToCm360 — mode cm360 passe-plat', () => {
  assert.strictEqual(F.gameSensToCm360('cm360', 42, 800), 42);
});

test('roundtrip sens → cm/360 → sens (tous les jeux)', () => {
  for (const mode of Object.keys(F.YAW_RATES)) {
    const sens = 0.75, dpi = 1600;
    const cm = F.gameSensToCm360(mode, sens, dpi);
    const back = F.cm360ToGameSens(mode, cm, dpi);
    assert.ok(Math.abs(back - sens) < 1e-9, `${mode}: ${sens} → ${cm} → ${back}`);
  }
});

test('cm360ToRad — 34 cm @ 800 DPI', () => {
  const rad = F.cm360ToRad(34, 800);
  const expected = (2 * Math.PI * 2.54) / (34 * 800);
  assert.strictEqual(rad, expected);
  // Un tour complet = (34 * 800 / 2.54) counts × rad = 2π
  const countsPerTurn = 34 * 800 / 2.54;
  assert.ok(Math.abs(countsPerTurn * rad - 2 * Math.PI) < 1e-9);
});

test('cm360ToRad — entrées invalides → NaN (pas de crash)', () => {
  assert.ok(Number.isNaN(F.cm360ToRad(0, 800)));
  assert.ok(Number.isNaN(F.cm360ToRad(34, 0)));
  assert.ok(Number.isNaN(F.gameSensToCm360('valorant', 0, 800)));
  assert.ok(Number.isNaN(F.gameSensToCm360('inconnu', 1, 800)));
});

test('threadsFromThresholds — seuils Viscose', () => {
  const th = [500, 600, 680, 750, 800, 840, 870, 900];
  assert.strictEqual(F.threadsFromThresholds(th, 0), 0);
  assert.strictEqual(F.threadsFromThresholds(th, 499), 0);
  assert.strictEqual(F.threadsFromThresholds(th, 500), 1);   // seuil atteint = inclus
  assert.strictEqual(F.threadsFromThresholds(th, 749), 3);
  assert.strictEqual(F.threadsFromThresholds(th, 900), 8);
  assert.strictEqual(F.threadsFromThresholds(th, 99999), 8);
  assert.strictEqual(F.threadsFromThresholds(null, 500), 0);
});

test('median — impair, pair, vide', () => {
  assert.strictEqual(F.median([300, 100, 200]), 200);
  assert.strictEqual(F.median([100, 200, 300, 400]), 300); // convention upper-mid
  assert.strictEqual(F.median([]), null);
  assert.strictEqual(F.median(null), null);
});

test('estimatePercentile — interpolation + bornes', () => {
  const bp = { p10: 100, p25: 250, p50: 500, p75: 750, p90: 900 };
  assert.strictEqual(F.estimatePercentile(50, bp), 10);    // sous le min → p10
  assert.strictEqual(F.estimatePercentile(100, bp), 10);
  assert.strictEqual(F.estimatePercentile(375, bp), 38);   // mi-chemin 250→500 = 25+12.5
  assert.strictEqual(F.estimatePercentile(500, bp), 50);
  assert.strictEqual(F.estimatePercentile(900, bp), 99);   // au max → 99, jamais 100
  assert.strictEqual(F.estimatePercentile(5000, bp), 99);
  assert.strictEqual(F.estimatePercentile(null, bp), null);
  assert.strictEqual(F.estimatePercentile(500, {}), null); // pas de breakpoints
});
