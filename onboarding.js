// ============================================================
// MayhAim — Onboarding premier lancement
// Wizard plein écran en 4 étapes (bienvenue → sensibilité →
// tour du hub → premier entraînement), skippable à tout moment.
//
// Chargé APRÈS game3d.js : s'appuie sur les globals existants
//   - MayhFormulas (shared/formulas.js) : conversions sens ↔ cm/360
//   - loadSettings/saveSettings/applySettings/startGame/resetRunState (game3d.js)
//   - icon/showToast (ui.js), coachingSwitchTab (coaching.js)
//
// Déclenchement : coaching.js#showApp() appelle maybeShowOnboarding()
// après connexion — le wizard ne s'affiche donc JAMAIS par-dessus
// l'écran d'auth ni pendant une partie.
// Relance manuelle : bouton « Revoir le tutoriel » (Paramètres → Jeu)
// qui appelle startOnboarding(true).
// ============================================================

const ONBOARDING_KEY = 'mayh_onboarded';

// ── Détection premier lancement ──
// Exécutée au chargement (après le reset DATA_VERSION de game3d.js qui
// préserve ch_token + visc_settings). Si des données locales existent
// déjà, l'utilisateur n'est pas nouveau : on pose le flag silencieusement
// pour ne jamais lui montrer le wizard.
(function onbDetectExistingUser() {
  try {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    let hasData =
      !!localStorage.getItem('ch_token') ||      // session déjà connectée
      !!localStorage.getItem('visc_settings') || // réglages personnalisés
      !!localStorage.getItem('visc_career');     // parties déjà jouées
    if (!hasData) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('visc_runs_') || k.startsWith('visc_bench_'))) { hasData = true; break; }
      }
    }
    if (hasData) localStorage.setItem(ONBOARDING_KEY, '1');
  } catch { /* localStorage indisponible → pas d'onboarding */ }
})();

// Appelé par showApp() (coaching.js) à chaque entrée dans le hub.
// No-op si le flag est posé (skip/complété/utilisateur existant).
function maybeShowOnboarding() {
  try {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
  } catch { return; }
  startOnboarding(false);
}

// force=true : relance manuelle depuis Paramètres (« Revoir le tutoriel »)
function startOnboarding(force) {
  if (document.getElementById('onboarding-overlay')) return; // déjà ouvert
  // Jamais par-dessus une partie ou un écran de résultats en cours
  const gameActive = document.getElementById('game-screen')?.classList.contains('active')
    || document.getElementById('results-screen')?.classList.contains('active')
    || (typeof G !== 'undefined' && G.running);
  if (gameActive) {
    if (force && window.showToast) showToast.warn('Termine ta partie avant de revoir le tutoriel.');
    return;
  }
  _onbBuild();
  document.addEventListener('keydown', _onbKeydown);
  _onbGoto(0);
}

// ── Construction du DOM (injecté à la volée, rien dans index.html) ──
function _onbBuild() {
  const _i = (n, s) => (window.icon ? window.icon(n, s) : '');

  // Pré-remplissage sensibilité depuis les settings existants (même clé
  // localStorage que l'écran Réglages : visc_settings).
  let dpi = 800, sens = 0.48;
  try {
    const s = (typeof loadSettings === 'function') ? loadSettings() : {};
    dpi = parseInt(s.dpi) || 800;
    if (s.sensMode === 'valorant' && s.sensVal) {
      sens = s.sensVal;
    } else if (window.MayhFormulas) {
      const conv = MayhFormulas.cm360ToGameSens('valorant', s.cm360 || 34, dpi);
      if (Number.isFinite(conv) && conv > 0) sens = conv;
    }
    sens = Math.round(sens * 100) / 100;
  } catch {}

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="onb-card">
      <div class="onb-head">
        <div class="onb-dots" aria-hidden="true">
          <span class="onb-dot"></span><span class="onb-dot"></span><span class="onb-dot"></span><span class="onb-dot"></span>
        </div>
        <button class="onb-skip" onclick="onbSkip()" title="Passer le tutoriel">Passer ✕</button>
      </div>

      <!-- ── Étape 1 : Bienvenue ── -->
      <div class="onb-step" data-step="0">
        <div class="onb-hero-icon">${_i('crosshair', 44)}</div>
        <h2 class="onb-title">Bienvenue sur <span class="onb-brand">Mayh<span>Aim</span></span></h2>
        <p class="onb-sub">L'aim trainer pensé pour Valorant : entraîne ta visée, mesure ta progression avec le Viscose Benchmark et progresse grâce au coaching — tout au même endroit.</p>
        <div class="onb-footer">
          <span></span>
          <button class="btn-primary" onclick="onbNext()">C'est parti →</button>
        </div>
      </div>

      <!-- ── Étape 2 : Sensibilité ── -->
      <div class="onb-step" data-step="1">
        <h2 class="onb-title">${_i('mouse-pointer', 22)} Ta sensibilité</h2>
        <p class="onb-sub">Reproduis exactement ta visée Valorant dans MayhAim. Modifiable à tout moment dans les Paramètres.</p>
        <div class="onb-sens-form">
          <div class="sett-row">
            <span class="sett-row-label">DPI de ta souris</span>
            <input type="number" id="onb-dpi" class="sett-input" min="100" max="32000" step="50" value="${dpi}" oninput="onbUpdateCm()" style="width:96px">
          </div>
          <div class="sett-row">
            <span class="sett-row-label">Sensibilité Valorant</span>
            <input type="number" id="onb-sens" class="sett-input" min="0.01" max="10" step="0.01" value="${sens}" oninput="onbUpdateCm()" style="width:96px">
          </div>
          <div class="sett-computed onb-cm-line">≈ <span id="onb-cm360">—</span> cm/360°</div>
          <p class="onb-hint">Le cm/360, c'est la distance que parcourt ta souris pour faire un tour complet — la mesure universelle de la sensibilité.</p>
        </div>
        <div class="onb-footer">
          <button class="btn-secondary" onclick="onbPrev()">← Retour</button>
          <button class="btn-primary" onclick="onbNext()">Enregistrer et continuer →</button>
        </div>
      </div>

      <!-- ── Étape 3 : Tour du hub ── -->
      <div class="onb-step" data-step="2">
        <h2 class="onb-title">${_i('map', 22)} Ton hub d'entraînement</h2>
        <p class="onb-sub">Tout est accessible depuis la barre latérale. Voici les 5 essentiels :</p>
        <div class="onb-tour-grid">
          <div class="onb-tour-card">
            <span class="onb-tour-icon">${_i('zap', 26)}</span>
            <span class="onb-tour-name">Entraînement</span>
            <span class="onb-tour-desc">Free Play &amp; Viscose Benchmark — des dizaines de scénarios pour flicks, tracking et switching.</span>
          </div>
          <div class="onb-tour-card">
            <span class="onb-tour-icon">${_i('flame', 26)}</span>
            <span class="onb-tour-name">Warmup</span>
            <span class="onb-tour-desc">Routine d'échauffement guidée (physique, yeux, mental, aim) avant tes ranked.</span>
          </div>
          <div class="onb-tour-card">
            <span class="onb-tour-icon">${_i('gamepad', 26)}</span>
            <span class="onb-tour-name">Tracker</span>
            <span class="onb-tour-desc">Tes stats Valorant analysées : rang, K/D, headshot% et historique de matchs.</span>
          </div>
          <div class="onb-tour-card">
            <span class="onb-tour-icon">${_i('crosshair', 26)}</span>
            <span class="onb-tour-name">Stratégies</span>
            <span class="onb-tour-desc">Scénarios tactiques par map et par rang, avec guides pas à pas.</span>
          </div>
          <div class="onb-tour-card">
            <span class="onb-tour-icon">${_i('user', 26)}</span>
            <span class="onb-tour-name">Profil</span>
            <span class="onb-tour-desc">Ta progression, tes succès, ton classement et ton radar de compétences.</span>
          </div>
        </div>
        <div class="onb-footer">
          <button class="btn-secondary" onclick="onbPrev()">← Retour</button>
          <button class="btn-primary" onclick="onbNext()">Continuer →</button>
        </div>
      </div>

      <!-- ── Étape 4 : Premier entraînement ── -->
      <div class="onb-step" data-step="3">
        <div class="onb-hero-icon">${_i('rocket', 44)}</div>
        <h2 class="onb-title">Prêt à t'entraîner ?</h2>
        <p class="onb-sub">On commence en douceur : <strong>Gridshot</strong>, difficulté facile, 60 secondes. Clique sur les sphères le plus vite possible — idéal pour prendre tes marques.</p>
        <div class="onb-footer onb-footer-final">
          <button class="btn-secondary" onclick="onbPrev()">← Retour</button>
          <div class="onb-final-actions">
            <button class="btn-secondary" onclick="onbFinishExplore()">Explorer le hub</button>
            <button class="btn-primary" onclick="onbLaunchTraining()">${_i('play', 15)} Lancer mon premier entraînement</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  onbUpdateCm();
}

// ── Navigation ──
let _onbStep = 0;

function _onbGoto(n) {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  _onbStep = Math.max(0, Math.min(3, n));
  overlay.querySelectorAll('.onb-step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === _onbStep);
  });
  overlay.querySelectorAll('.onb-dot').forEach((d, i) => {
    d.classList.toggle('active', i === _onbStep);
    d.classList.toggle('done', i < _onbStep);
  });
  overlay.querySelector('.onb-step.active .btn-primary')?.focus();
}

function onbNext() {
  if (_onbStep === 1) _onbSaveSens(); // quitter l'étape sensibilité = enregistrer
  _onbGoto(_onbStep + 1);
}
function onbPrev() { _onbGoto(_onbStep - 1); }

// ── Étape 2 : calcul live + sauvegarde ──
function _onbReadSensInputs() {
  const dpi = parseInt(document.getElementById('onb-dpi')?.value);
  const sens = parseFloat(document.getElementById('onb-sens')?.value);
  return { dpi, sens };
}

function onbUpdateCm() {
  const el = document.getElementById('onb-cm360');
  if (!el || !window.MayhFormulas) return;
  const { dpi, sens } = _onbReadSensInputs();
  const cm = MayhFormulas.gameSensToCm360('valorant', sens, dpi);
  el.textContent = (Number.isFinite(cm) && cm > 0) ? String(Math.round(cm * 10) / 10) : '—';
}

function _onbSaveSens() {
  const { dpi, sens } = _onbReadSensInputs();
  // Valeurs manquantes/invalides → on n'écrase rien (le jeu garde ses défauts,
  // « Lancer mon premier entraînement » fonctionne quand même).
  if (!Number.isFinite(dpi) || dpi < 100 || dpi > 32000) return;
  if (!Number.isFinite(sens) || sens <= 0) return;
  if (!window.MayhFormulas || typeof saveSettings !== 'function') return;
  const cm = MayhFormulas.gameSensToCm360('valorant', sens, dpi);
  if (!Number.isFinite(cm) || cm <= 0) return;
  // Mêmes clés que l'écran Réglages (visc_settings) — puis resynchronisation
  // des inputs #opt-* : startGame() lit le DOM, pas seulement le localStorage.
  saveSettings({ dpi: dpi, sensMode: 'valorant', sensVal: sens, cm360: cm });
  if (typeof applySettings === 'function') applySettings();
  if (window.showToast) showToast.success('Sensibilité enregistrée : ≈ ' + (Math.round(cm * 10) / 10) + ' cm/360°');
}

// ── Sorties ──
function _onbClose() {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
  document.removeEventListener('keydown', _onbKeydown);
  document.getElementById('onboarding-overlay')?.remove();
}

function onbSkip() {
  _onbClose();
  if (window.showToast) showToast.info('Tu peux revoir le tutoriel dans Paramètres → Jeu.');
}

function onbFinishExplore() {
  _onbClose();
  if (typeof coachingSwitchTab === 'function') coachingSwitchTab('hub-home');
}

function onbLaunchTraining() {
  _onbClose(); // fermer AVANT de lancer : la partie ne démarre jamais sous le wizard
  try {
    // Scénario facile : Gridshot easy 60s. Fonctionne même si l'étape
    // sensibilité a été sautée (défauts DPI 800 / 34 cm/360 déjà en place).
    const diffSel = document.getElementById('opt-diff');
    if (diffSel) diffSel.value = 'easy';
    const durSel = document.getElementById('opt-duration');
    if (durSel) durSel.value = '60';
    if (typeof resetRunState === 'function') resetRunState(); // pas de benchmark/warmup fantôme
    if (typeof startGame === 'function') {
      startGame('gridshot');
    } else if (window.showToast) {
      showToast.error("Impossible de lancer l'entraînement");
    }
  } catch (e) {
    console.warn('[onboarding] lancement entraînement échoué', e);
    if (window.showToast) showToast.error("Impossible de lancer l'entraînement");
  }
}

function _onbKeydown(e) {
  if (e.key === 'Escape' && document.getElementById('onboarding-overlay')) onbSkip();
}

// Exports explicites (onclick inline + hook showApp + bouton Paramètres)
window.maybeShowOnboarding = maybeShowOnboarding;
window.startOnboarding = startOnboarding;
window.onbNext = onbNext;
window.onbPrev = onbPrev;
window.onbSkip = onbSkip;
window.onbUpdateCm = onbUpdateCm;
window.onbFinishExplore = onbFinishExplore;
window.onbLaunchTraining = onbLaunchTraining;
