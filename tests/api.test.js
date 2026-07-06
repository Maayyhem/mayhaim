// Tests API — smoke require de chaque endpoint + logique pure exportée.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Chaque fichier api/*.js doit se require() sans crash (imports, syntaxe
// top-level, IIFE de démarrage) — c'est ce que Vercel fait au cold start.
test('smoke require de tous les endpoints api/', () => {
  const apiDir = path.join(__dirname, '..', 'api');
  const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 10, `attendu ≥10 endpoints, trouvé ${files.length}`);
  for (const f of files) {
    const mod = require(path.join(apiDir, f));
    assert.strictEqual(typeof mod, 'function', `${f} doit exporter un handler`);
  }
});

// Miroir serveur de estimatePercentile — doit rester cohérent avec
// shared/formulas.js (même logique, testée des deux côtés).
test('estimatePercentile serveur === formules partagées', () => {
  const server = require('../api/coaching.js').estimatePercentile;
  const shared = require('../shared/formulas.js').estimatePercentile;
  assert.strictEqual(typeof server, 'function');
  const bp = { p10: 120, p25: 300, p50: 560, p75: 800, p90: 950 };
  for (const score of [0, 120, 250, 430, 560, 700, 949, 950, 10000]) {
    assert.strictEqual(server(score, bp), shared(score, bp), `divergence à score=${score}`);
  }
});
