// ============================================================
// MayhAim — formules pures (sensibilité, threads, stats)
// UMD : chargé en <script> par le navigateur (global MayhFormulas)
// et importable en require() par les tests node (tests/).
// AUCUNE dépendance DOM ici — le DPI est un paramètre explicite.
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MayhFormulas = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Yaw rate (degrés par count souris à sens 1.0) par jeu.
  const YAW_RATES = { valorant: 0.07, cs2: 0.022, overwatch: 0.0066, apex: 0.022, fortnite: 0.5555 };

  // cm/360 = 2.54 * 360 / (gameSens * yawRate * DPI)
  function gameSensToCm360(mode, val, dpi) {
    if (mode === 'cm360') return val;
    const yaw = YAW_RATES[mode];
    if (!yaw || !val || !dpi) return NaN;
    return 2.54 * 360 / (val * yaw * dpi);
  }

  // Symétrique : la formule est une involution (sens ↔ cm/360).
  function cm360ToGameSens(mode, cm360, dpi) {
    if (mode === 'cm360') return cm360;
    const yaw = YAW_RATES[mode];
    if (!yaw || !cm360 || !dpi) return NaN;
    return 2.54 * 360 / (cm360 * yaw * dpi);
  }

  // Radians par count souris pour un cm/360 donné.
  function cm360ToRad(cm360, dpi) {
    if (!cm360 || !dpi) return NaN;
    return (2 * Math.PI * 2.54) / (cm360 * dpi);
  }

  // Threads Viscose : nombre de seuils atteints par un score.
  function threadsFromThresholds(thresholds, score) {
    if (!Array.isArray(thresholds)) return 0;
    return thresholds.filter(t => score >= t).length;
  }

  // Médiane (utilisée pour la réaction médiane des résultats).
  function median(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  // Percentile estimé par interpolation linéaire entre breakpoints
  // p10/p25/p50/p75/p90 (miroir de la logique serveur api/coaching.js).
  function estimatePercentile(score, bp) {
    if (score == null || !isFinite(score) || !bp) return null;
    const pts = [
      [10, bp.p10 != null ? Number(bp.p10) : null],
      [25, bp.p25 != null ? Number(bp.p25) : null],
      [50, bp.p50 != null ? Number(bp.p50) : null],
      [75, bp.p75 != null ? Number(bp.p75) : null],
      [90, bp.p90 != null ? Number(bp.p90) : null],
    ].filter(([, v]) => v != null && isFinite(v));
    if (pts.length === 0) return null;
    if (score <= pts[0][1]) return pts[0][0];
    if (score >= pts[pts.length - 1][1]) return 99;
    for (let i = 1; i < pts.length; i++) {
      const [pA, vA] = pts[i - 1];
      const [pB, vB] = pts[i];
      if (score >= vA && score <= vB) {
        if (vB === vA) return pB;
        return Math.round(pA + (pB - pA) * (score - vA) / (vB - vA));
      }
    }
    return null;
  }

  return { YAW_RATES, gameSensToCm360, cm360ToGameSens, cm360ToRad, threadsFromThresholds, median, estimatePercentile };
});
