// ============ COACHING HUB + GLOBAL AUTH ============

const API_BASE = '/.netlify/functions';

let coachingUser = null;
let coachingUserRole = null;
let coachingToken = null;

(function restoreSession() {
  const saved = localStorage.getItem('ch_token');
  if (saved) coachingToken = saved;
})();

// ============ LOCAL STORAGE TRACKING ============

function getWatchedVods() { try { return JSON.parse(localStorage.getItem('ch_watched_vods')) || []; } catch { return []; } }
function markVodWatched(id) { const w = getWatchedVods(); if (!w.includes(id)) { w.push(id); localStorage.setItem('ch_watched_vods', JSON.stringify(w)); } }
function getCompletedScenarios() { try { return JSON.parse(localStorage.getItem('ch_completed_scenarios')) || []; } catch { return []; } }
function markScenarioCompleted(id) { const c = getCompletedScenarios(); if (!c.includes(id)) { c.push(id); localStorage.setItem('ch_completed_scenarios', JSON.stringify(c)); } }
function getSessionCount() { return parseInt(localStorage.getItem('ch_sessions') || '0'); }
function incrementSessions() { localStorage.setItem('ch_sessions', String(getSessionCount() + 1)); }

// ============ DATA: AGENTS ============

const agentsGuide = [
  { name: 'Brimstone', role: 'Controller', summary: "Controleur fiable avec 3 smokes longue duree et un ulti devastateur. Ideal pour organiser des executes coordonnees et dominer le post-plant grace a ses mollys.", howToPlay: "En attaque : place tes 3 smokes sur les crossfires cles du site vise, puis entre avec ton equipe. En defense : garde 1-2 smokes pour les retakes. Ton ulti + molly = combo imbattable pour deny le defuse. Joue toujours en soutien, jamais en first." },
  { name: 'Omen', role: 'Controller', summary: "Controleur versatile qui excelle dans la deception. Ses smokes se rechargent, son TP permet des repositionnements imprevus, et son ulti cree une pression globale.", howToPlay: "Place tes smokes en profondeur pour isoler les duels (one-way si possible). Utilise tes TP pour changer d'angle apres chaque kill. En mid-round, flanke avec ton TP pour backstab. Ton ulti est parfait pour info ou retakes surprise." },
  { name: 'Viper', role: 'Controller', summary: "Specialiste du controle toxique avec un mur et un orbe qui drainent la vie. Imbattable en post-plant et sur les maps avec de longues lignes de vue.", howToPlay: "Apprends 2-3 line-ups de mur et de molly par map. Garde ton fuel pour les moments critiques. En post-plant : molly le spike + mur pour couper les angles. Son ulti transforme un site entier en forteresse." },
  { name: 'Astra', role: 'Controller', summary: "Controleur strategique a l'echelle globale. Place ses etoiles pour creer smokes, stuns, et aspirations n'importe ou sur la map.", howToPlay: "Avant le round : place tes etoiles sur les choke points. Pull pour stopper les rushes, stun pour ouvrir les sites. Communique en permanence - Astra est inutile sans coordination." },
  { name: 'Harbor', role: 'Controller', summary: "Controleur dynamique dont le mur d'eau mobile accompagne les pushes.", howToPlay: "Lance ton mur pour accompagner le rush. Les cascades ralentissent les rotations. L'ulti est devastateur sur les sites fermes." },
  { name: 'Clove', role: 'Controller', summary: "Controleur agressif unique qui peut poser des smokes meme apres sa mort.", howToPlay: "Joue plus agressif qu'un controleur classique. Si tu meurs pendant une execute, pose immediatement tes smokes depuis la mort pour finir le round." },
  { name: 'Jett', role: 'Duelist', summary: "Entry fragger aerienne avec une mobilite sans egale. Son dash permet des peeks agressifs sans risque.", howToPlay: "Prepare TOUJOURS ton dash avant un peek agressif. Entre en premier avec l'util de tes mates. Apres un kill, dash pour eviter le trade." },
  { name: 'Reyna', role: 'Duelist', summary: "Duelist purement orientee combat 1v1 qui snowball sur ses kills.", howToPlay: "Ne prends JAMAIS un duel sans orbe disponible. Apres chaque kill : dismiss pour sortir ou heal pour rester agressif." },
  { name: 'Raze', role: 'Duelist', summary: "Duelist explosive specialisee dans le nettoyage de zone. Ses satchels offrent une mobilite aerienne unique.", howToPlay: "Ouvre chaque round avec ta nade sur les positions standards. Double satchel pour entrer par les airs. Ton ulti doit garantir un kill decisif." },
  { name: 'Phoenix', role: 'Duelist', summary: "Duelist auto-suffisant avec flashs, mur de feu et molly de soin.", howToPlay: "Ta flash courbe est parfaite pour les peeks solo. Utilise mur + molly pour te soigner. Ton ulti est un entry parfait sans risque." },
  { name: 'Yoru', role: 'Duelist', summary: "Duelist furtif specialise dans les flanks, fakes et timings inattendus.", howToPlay: "Pre-place ton TP dans une position safe. Combine faux pas + TP pour fakes. En ulti : prends l'info deep puis backstab." },
  { name: 'Neon', role: 'Duelist', summary: "Duelist a haute velocite qui casse tous les timings.", howToPlay: "Utilise ton mur pour creer un couloir d'entree safe, puis slide pour prendre le site. Ne cours jamais en ligne droite." },
  { name: 'Iso', role: 'Duelist', summary: "Duelist methodique qui excelle dans les duels isoles. Son bouclier absorbe un tir mortel.", howToPlay: "Active ton bouclier avant chaque peek. L'ulti cible les joueurs problematiques : l'oppeur, l'anchor, ou le clutcher." },
  { name: 'Miks', role: 'Duelist', summary: "Duelist tactique avec des capacites de disruption sonore.", howToPlay: "Utilise tes capacites sonores pour deorienter les defenseurs avant d'entrer. Combine tes disruptions avec les flashs de tes initiators." },
  { name: 'Sova', role: 'Initiator', summary: "Initiator d'info supreme avec drone et fleche de recon.", howToPlay: "Apprends 3-5 line-ups de fleche par map. Drone AVANT que tes duelists entrent. Garde les shock darts pour le post-plant." },
  { name: 'Skye', role: 'Initiator', summary: "Initiator hybride avec flash guidee, chien eclaireur et heal d'equipe.", howToPlay: "Pop-flash TOUJOURS pour tes duelists. Ton chien clear les zones dangereuses. Le heal est precieux : priorise les joueurs a bas HP." },
  { name: 'Fade', role: 'Initiator', summary: "Initiator qui traque et paralyse les ennemis.", howToPlay: "Lance ta haunt au debut de chaque execute. Les snares sur les choke points punissent les pushes. L'ulti est parfait pour les retakes." },
  { name: 'KAY/O', role: 'Initiator', summary: "Initiator anti-capacites qui neutralise l'util ennemi dans une zone.", howToPlay: "Lance ton knife de suppression AVANT l'execute. Tes flashs sont rapides - right-click pour pop-flash. En ulti, entre en premier car tu peux te faire revive." },
  { name: 'Breach', role: 'Initiator', summary: "Initiator de breche qui traverse les murs avec stuns, flashs et tremblements.", howToPlay: "Coordonne TOUJOURS tes stuns avec l'entry de ton duelist. L'ulti est devastateur sur les petits sites." },
  { name: 'Gekko', role: 'Initiator', summary: "Initiator polyvalent avec des creatures recuperables. Le meilleur pick pour solo-queue.", howToPlay: "Mosh pit sur les coins standards. Wingman peut planter ou defuser pendant que tu couvres. Recupere TOUJOURS tes creatures." },
  { name: 'Sage', role: 'Sentinel', summary: "Sentinel de soutien avec mur, slows et resurrection.", howToPlay: "Le mur peut bloquer les rushs OU creer des angles eleves. Ton rez doit changer le round : priorise l'oppeur, l'anchor ou l'entry." },
  { name: 'Killjoy', role: 'Sentinel', summary: "Sentinel de zone avec tourelle, alarmbots et nanoswarms.", howToPlay: "Setup ta tourelle + alarmbot pour couvrir l'entree principale. Les nanoswarms sous le spike = deny defuse garanti." },
  { name: 'Cypher', role: 'Sentinel', summary: "Sentinel d'information avec camera, trips et cage.", howToPlay: "Camera + trips sur les points d'entree cles. Donne l'info DES que tu detectes quelque chose. Change tes placements chaque round." },
  { name: 'Chamber', role: 'Sentinel', summary: "Sentinel orientee duel avec TP defensif et armes de precision.", howToPlay: "Place ton TP avant de prendre une ligne agressive. Apres un kill, TP IMMEDIATEMENT pour eviter le trade." },
];

// ============ DATA: SCENARIOS (default, will be overridden by DB) ============

let coachingScenarios = [
  { id: 1, title: "B Site Take - Bind", rank: "BRONZE", map: "Bind", type: "attack", difficulty: 1, description: "Entree B simple avec smoke et flash.", guide: "1. Smoke hookah et long B\n2. Flash pour ton duelist\n3. Le duelist entre par short B\n4. Le second joueur clear garden\n5. Plante default", tips: "Ne rush jamais sans smokes. Toujours clear les coins un par un.", aimMode: "pasu_reload", aimDiff: "easy" },
  { id: 2, title: "A Site Hold - Ascent", rank: "BRONZE", map: "Ascent", type: "defense", difficulty: 1, description: "Defense du site A avec crossfire basique.", guide: "1. Un joueur tient le generator\n2. Un joueur tient heaven\n3. Crossfire main et short\n4. Call et rotate si push", tips: "Le crossfire generator + heaven est tres puissant.", aimMode: "speedflick", aimDiff: "easy" },
  { id: 3, title: "A Site Retake - Haven", rank: "SILVER", map: "Haven", type: "retake", difficulty: 2, description: "Retake du site A apres plant ennemi.", guide: "1. Regroupe-toi avec ton equipe\n2. Utilise les utils pour clear\n3. Flash/stun long A et sewers\n4. Peek ensemble\n5. Check le timer avant defuse", tips: "Le timing est crucial en retake. Defuse toujours a couvert.", aimMode: "pasu_reload", aimDiff: "medium" },
  { id: 4, title: "Mid Control - Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2, description: "Prise du mid pour ouvrir les rotations.", guide: "1. Smoke vent et mail\n2. Clear mid avec drone/flash\n3. Hold mid bottom\n4. Execute A ou B selon l'info", tips: "Celui qui controle le mid controle le round.", aimMode: "pokeball_frenzy", aimDiff: "medium" },
  { id: 5, title: "Full Execute - Lotus", rank: "DIAMOND", map: "Lotus", type: "attack", difficulty: 5, description: "Execute complete sur A site avec 5 joueurs.", guide: "1. Drone/haunt pour reveler\n2. Smokes sur tree et rubble\n3. Flash + stun simultanement\n4. Entry par main + root\n5. Plant default", tips: "Le timing des utils doit etre au dixieme de seconde pres.", aimMode: "gridshot", aimDiff: "hard" },
];

// ============ DATA: VODS (from CSV) ============

function extractYoutubeId(url) {
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? m[1].split('&')[0] : '';
}

const defaultVods = [
  { id:"v1", player:"S0m", agent:"Tejo", map:"Pearl", channel:"Valorant Daily", youtube_id:"cXnVZDJeBOk" },
  { id:"v2", player:"S0m", agent:"Astra", map:"Pearl", channel:"Valorant Daily", youtube_id:"6ikcUzOGNlk" },
  { id:"v3", player:"Oxy", agent:"Waylay", map:"Haven", channel:"Valorant Daily", youtube_id:"wNLEpJTrQfk" },
  { id:"v4", player:"Oxy", agent:"Waylay", map:"Haven", channel:"Valorant Daily", youtube_id:"yRTgnXwtU8o" },
  { id:"v5", player:"S0m", agent:"Neon", map:"Sunset", channel:"Valorant Daily", youtube_id:"11_ivd5uBFM" },
  { id:"v6", player:"S0m", agent:"Omen", map:"Haven", channel:"Valorant Daily", youtube_id:"t4e-fC-T2lk" },
  { id:"v7", player:"Demon1", agent:"Jett", map:"Bind", channel:"Valorant Daily", youtube_id:"RiWxH3yW23E" },
  { id:"v8", player:"Demon1", agent:"Waylay", map:"Haven", channel:"Valorant Daily", youtube_id:"uCkmW95NSfE" },
  { id:"v9", player:"S0m", agent:"Omen", map:"Haven", channel:"Valorant Daily", youtube_id:"Tm2qGnGsYYA" },
  { id:"v10", player:"Demon1", agent:"Waylay", map:"Split", channel:"Valorant Daily", youtube_id:"RjL_GPuqBQ4" },
  { id:"v11", player:"Demon1", agent:"Waylay", map:"Split", channel:"Valorant Daily", youtube_id:"7XibX7vmV54" },
  { id:"v12", player:"Zander", agent:"Omen", map:"Split", channel:"Valorant Daily", youtube_id:"7a2Ui-Nk9JE" },
  { id:"v13", player:"Zekken", agent:"Reyna", map:"Split", channel:"Valorant Daily", youtube_id:"YlER6SPp71U" },
  { id:"v14", player:"Zekken", agent:"Clove", map:"Corrode", channel:"Valorant Daily", youtube_id:"RMoRUHYCTDs" },
  { id:"v15", player:"WoOt", agent:"Neon", map:"Sunset", channel:"Valorant Daily", youtube_id:"SvBoog4cFGM" },
  { id:"v16", player:"Oxy", agent:"Sova", map:"Sunset", channel:"Valorant Daily", youtube_id:"BfAe8ZxoDLo" },
  { id:"v17", player:"nAts", agent:"Cypher", map:"Split", channel:"Valorant Daily", youtube_id:"MzayPyfyFR0" },
  { id:"v18", player:"nAts", agent:"Astra", map:"Corrode", channel:"Valorant Daily", youtube_id:"tU-iArWHn3I" },
  { id:"v19", player:"Demon1", agent:"Iso", map:"Haven", channel:"Valorant Daily", youtube_id:"RAs7Ww55H64" },
  { id:"v20", player:"Jinggg", agent:"Raze", map:"Bind", channel:"Valorant Daily", youtube_id:"qYbpM5hAdD4" },
  { id:"v21", player:"S0m", agent:"Yoru", map:"Pearl", channel:"Valorant Daily", youtube_id:"kSufjUEgCVs" },
  { id:"v22", player:"nAts", agent:"Viper", map:"Bind", channel:"Valorant Daily", youtube_id:"12gUUm5OzSQ" },
  { id:"v23", player:"WoOt", agent:"Deadlock", map:"Bind", channel:"Valorant Daily", youtube_id:"Yo0Ak61UFT8" },
  { id:"v24", player:"Kajaak", agent:"Yoru", map:"Bind", channel:"Valorant Daily", youtube_id:"buKeNQZkwd0" },
  { id:"v25", player:"Kajaak", agent:"Jett", map:"Pearl", channel:"Valorant Daily", youtube_id:"9cwEIQZVxJ8" },
  { id:"v26", player:"Brawk", agent:"Reyna", map:"Abyss", channel:"Valorant Daily", youtube_id:"C_rjlNF2c1c" },
  { id:"v27", player:"Jinggg", agent:"Jett", map:"Haven", channel:"Valorant Daily", youtube_id:"_MDuPmhrvvE" },
  { id:"v28", player:"Brawk", agent:"Sova", map:"Pearl", channel:"Valorant Daily", youtube_id:"702NeQ2_OWg" },
  { id:"v29", player:"Aleksander", agent:"Veto", map:"Sunset", channel:"Valorant Daily", youtube_id:"tohjz-5u1gg" },
  { id:"v30", player:"S0m", agent:"Fade", map:"Corrode", channel:"Valorant Daily", youtube_id:"wFZCT3JNazg" },
  { id:"v31", player:"nAts", agent:"Cypher", map:"Split", channel:"Valorant Daily", youtube_id:"dObrTZhdZzc" },
  { id:"v32", player:"Oxy", agent:"Sova", map:"Breeze", channel:"Valorant Daily", youtube_id:"O6ZddKyAmeU" },
  { id:"v33", player:"Oxy", agent:"Clove", map:"Split", channel:"Valorant Daily", youtube_id:"s0VEDusGeYc" },
  { id:"v34", player:"Demon1", agent:"Jett", map:"Haven", channel:"Valorant Daily", youtube_id:"DS0x65-8aCY" },
  { id:"v35", player:"Demon1", agent:"Waylay", map:"Corrode", channel:"Valorant Daily", youtube_id:"0R7AVMeozzQ" },
  { id:"v36", player:"Derrek", agent:"Sova", map:"Abyss", channel:"Valorant Daily", youtube_id:"WeDiQ9WYu3Q" },
  { id:"v37", player:"Demon1", agent:"Unknown", map:"Breeze", channel:"Valorant Daily", youtube_id:"WykQ8rkF5L4" },
  { id:"v38", player:"Aleksandar", agent:"Sage", map:"Split", channel:"Valorant Daily", youtube_id:"uM0AZHpjYow" },
  { id:"v39", player:"ion", agent:"Jett", map:"Breeze", channel:"Valorant Daily", youtube_id:"79yfqzzP_-I" },
  { id:"v40", player:"Hiro", agent:"Clove", map:"Breeze", channel:"Valorant Daily", youtube_id:"R1Ltru6RqF4" },
  { id:"v41", player:"Aleksandar", agent:"Killjoy", map:"Haven", channel:"Valorant Daily", youtube_id:"wVScgdmXa80" },
  { id:"v42", player:"Derrek", agent:"Chamber", map:"Bind", channel:"Valorant Daily", youtube_id:"-AbbZu304Gs" },
  { id:"v43", player:"Oxy", agent:"Chamber", map:"Bind", channel:"Valorant Daily", youtube_id:"LUONk2TqrYA" },
  { id:"v44", player:"Oxy", agent:"Waylay", map:"Abyss", channel:"Valorant Daily", youtube_id:"swkqFnxT7Og" },
  { id:"v45", player:"Brawk", agent:"Sova", map:"Corrode", channel:"Valorant Daily", youtube_id:"tEAiokGNgWE" },
  { id:"v46", player:"Demon1", agent:"Skye", map:"Split", channel:"Valorant Daily", youtube_id:"RDKmIXTGapg" },
  { id:"v47", player:"Oxy", agent:"Chamber", map:"Bind", channel:"Valorant Daily", youtube_id:"omr-LJli76E" },
  { id:"v48", player:"Eggsterr", agent:"Yoru", map:"Breeze", channel:"Valorant Daily", youtube_id:"FQpwsUpOABg" },
  { id:"v49", player:"Oxy", agent:"Chamber", map:"Corrode", channel:"Valorant Daily", youtube_id:"kb9LP5arhAo" },
  { id:"v50", player:"Oxy", agent:"Clove", map:"Split", channel:"Valorant Daily", youtube_id:"-MDs12DpCfo" },
  { id:"v51", player:"Zander", agent:"Viper", map:"Breeze", channel:"Valorant Daily", youtube_id:"5xpYBva576c" },
  { id:"v52", player:"Demon1", agent:"Waylay", map:"Bind", channel:"Valorant Daily", youtube_id:"d_t64zHIe08" },
  { id:"v53", player:"Tarik", agent:"Jett", map:"Breeze", channel:"Valorant Daily", youtube_id:"qJzILRrWsP0" },
  { id:"v54", player:"Demon1", agent:"Jett", map:"Breeze", channel:"Valorant Daily", youtube_id:"cfohru8pytQ" },
  { id:"v55", player:"Oxy", agent:"Skye", map:"Bind", channel:"Valorant Daily", youtube_id:"ZeJ4XKlsjMo" },
  { id:"v56", player:"WoOt", agent:"Neon", map:"Pearl", channel:"Valorant Daily", youtube_id:"LBju0sK2p4g" },
  { id:"v57", player:"Oxy", agent:"Sova", map:"Abyss", channel:"Valorant Daily", youtube_id:"IdL5mQS4e_8" },
  { id:"v58", player:"Eggsterr", agent:"Yoru", map:"Breeze", channel:"Valorant Daily", youtube_id:"GMBEUkBdK0k" },
];

let coachingVods = defaultVods;

// ============ GLOBAL AUTH ============

function initGlobalAuth() {
  // Login
  document.getElementById('auth-login-btn')?.addEventListener('click', globalLogin);
  document.getElementById('auth-login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') globalLogin(); });
  // Register
  document.getElementById('auth-register-btn')?.addEventListener('click', globalRegister);
  document.getElementById('auth-reg-password2')?.addEventListener('keydown', e => { if (e.key === 'Enter') globalRegister(); });
  // Toggle forms
  document.getElementById('auth-toggle-register')?.addEventListener('click', () => {
    document.getElementById('auth-login-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
  });
  document.getElementById('auth-toggle-login')?.addEventListener('click', () => {
    document.getElementById('auth-login-form').style.display = 'block';
    document.getElementById('auth-register-form').style.display = 'none';
  });
  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', globalLogout);

  // Check existing session
  globalCheckSession();
}

async function globalCheckSession() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/profile`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (res.ok) {
      const data = await res.json();
      coachingUser = data.user;
      coachingUserRole = data.user.role;
      showApp();
    } else {
      localStorage.removeItem('ch_token');
      coachingToken = null;
    }
  } catch (e) { /* ignore */ }
}

async function globalLogin() {
  const email = document.getElementById('auth-login-email').value;
  const pw = document.getElementById('auth-login-password').value;
  const err = document.getElementById('auth-login-error');
  if (!email || !pw) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  try {
    const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    coachingToken = data.token;
    localStorage.setItem('ch_token', data.token);
    coachingUser = data.user;
    coachingUserRole = data.user.role;
    err.style.display = 'none';
    showApp();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

async function globalRegister() {
  const username = document.getElementById('auth-reg-username').value;
  const email = document.getElementById('auth-reg-email').value;
  const pw = document.getElementById('auth-reg-password').value;
  const pw2 = document.getElementById('auth-reg-password2').value;
  const err = document.getElementById('auth-reg-error');
  if (!email || !pw || !username) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  if (pw !== pw2) { err.textContent = 'Mots de passe differents'; err.style.display = 'block'; return; }
  try {
    const res = await fetch(`${API_BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw, username }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    coachingToken = data.token;
    localStorage.setItem('ch_token', data.token);
    coachingUser = data.user;
    coachingUserRole = data.user.role;
    err.style.display = 'none';
    showApp();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

function globalLogout() {
  coachingToken = null;
  coachingUser = null;
  coachingUserRole = null;
  localStorage.removeItem('ch_token');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('auth-screen').classList.add('active');
}

function showApp() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('menu-screen').classList.add('active');
  // Update user display
  const roleLabels = { admin: 'Admin', coach: 'Coach', student: 'Eleve' };
  document.getElementById('menu-user-name').textContent = coachingUser.username;
  const roleBadge = document.getElementById('menu-user-role');
  roleBadge.textContent = roleLabels[coachingUserRole] || 'Eleve';
  roleBadge.className = 'user-role-badge role-' + coachingUserRole;
  // Update coaching header
  document.getElementById('ch-user-info').textContent = coachingUser.username + ' (' + (roleLabels[coachingUserRole] || 'Eleve') + ')';
  // Show admin/coach tabs
  document.querySelectorAll('.ch-admin-only').forEach(el => {
    el.style.display = (coachingUserRole === 'admin' || coachingUserRole === 'coach') ? '' : 'none';
  });
  document.querySelectorAll('.ch-coach-only').forEach(el => {
    el.style.display = (coachingUserRole === 'admin' || coachingUserRole === 'coach') ? '' : 'none';
  });
}

// ============ COACHING INIT ============

function initCoaching() {
  document.getElementById('btn-coaching').addEventListener('click', () => {
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('coaching-screen').classList.add('active');
    coachingSwitchTab('ch-dashboard');
  });

  document.getElementById('btn-coaching-back').addEventListener('click', () => {
    coachingCloseVodModal();
    coachingCloseScenarioModal();
    coachingCloseEditModal();
    document.getElementById('coaching-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
  });

  document.querySelectorAll('.ch-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => coachingSwitchTab(btn.dataset.tab));
  });

  // Filters
  document.getElementById('ch-rank-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-map-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-type-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-agent-role-filter')?.addEventListener('change', coachingRenderAgents);
  document.getElementById('ch-agent-search')?.addEventListener('input', coachingRenderAgents);
  document.getElementById('ch-vod-player-filter')?.addEventListener('change', coachingRenderVods);
  document.getElementById('ch-vod-agent-filter')?.addEventListener('change', coachingRenderVods);
  document.getElementById('ch-vod-map-filter')?.addEventListener('change', coachingRenderVods);

  // Modal close on backdrop
  document.getElementById('ch-vod-modal')?.addEventListener('click', e => { if (e.target.id === 'ch-vod-modal') coachingCloseVodModal(); });
  document.getElementById('ch-scenario-modal')?.addEventListener('click', e => { if (e.target.id === 'ch-scenario-modal') coachingCloseScenarioModal(); });
  document.getElementById('ch-scenario-edit-modal')?.addEventListener('click', e => { if (e.target.id === 'ch-scenario-edit-modal') coachingCloseEditModal(); });

  // Add scenario button
  document.getElementById('ch-add-scenario-btn')?.addEventListener('click', () => coachingOpenEditModal(null));

  // Populate VOD filter dropdowns dynamically
  populateVodFilters();
}

function populateVodFilters() {
  const players = [...new Set(defaultVods.map(v => v.player))].sort();
  const agents = [...new Set(defaultVods.map(v => v.agent))].sort();
  const maps = [...new Set(defaultVods.map(v => v.map))].sort();

  const pSel = document.getElementById('ch-vod-player-filter');
  const aSel = document.getElementById('ch-vod-agent-filter');
  const mSel = document.getElementById('ch-vod-map-filter');

  players.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; pSel.appendChild(o); });
  agents.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; aSel.appendChild(o); });
  maps.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; mSel.appendChild(o); });
}

// ============ NAVIGATION ============

function coachingSwitchTab(tabId) {
  document.querySelectorAll('.ch-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ch-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  document.querySelector(`.ch-tab-btn[data-tab="${tabId}"]`)?.classList.add('active');

  if (tabId === 'ch-dashboard') coachingRenderDashboard();
  if (tabId === 'ch-scenarios') coachingRenderScenarios();
  if (tabId === 'ch-agents') coachingRenderAgents();
  if (tabId === 'ch-vods') coachingRenderVods();
  if (tabId === 'ch-students') coachingRenderStudents();
  if (tabId === 'ch-map-editor') { if (!ME.editingScenario) meUpdateScenarioBanner(); meLoadMapImg(); meRenderSteps(); meRender(); meRenderSaved(); }
  if (tabId === 'ch-manage-scenarios') coachingRenderManageScenarios();
}

// ============ DASHBOARD ============

function coachingRenderDashboard() {
  document.getElementById('ch-dash-sessions').textContent = getSessionCount();
  document.getElementById('ch-dash-scenarios').textContent = getCompletedScenarios().length;
  document.getElementById('ch-dash-accuracy').textContent = '-';
  document.getElementById('ch-dash-vods').textContent = getWatchedVods().length;
}

// ============ SCENARIOS ============

function coachingRenderScenarios() {
  const rank = document.getElementById('ch-rank-filter')?.value || '';
  const map = document.getElementById('ch-map-filter')?.value || '';
  const type = document.getElementById('ch-type-filter')?.value || '';

  let filtered = coachingScenarios;
  if (rank) filtered = filtered.filter(s => s.rank === rank);
  if (map) filtered = filtered.filter(s => s.map === map);
  if (type) filtered = filtered.filter(s => s.type === type);

  const list = document.getElementById('ch-scenarios-list');
  if (!list) return;
  list.innerHTML = '';
  if (!filtered.length) { list.innerHTML = '<p class="ch-empty">Aucun scenario trouve.</p>'; return; }

  const completed = getCompletedScenarios();
  filtered.forEach(s => {
    const done = completed.includes(s.id);
    const card = document.createElement('div');
    card.className = 'ch-card' + (done ? ' ch-done' : '');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="ch-badge">${s.rank || ''}</span>
        ${done ? '<span class="ch-badge-done">Complete</span>' : ''}
      </div>
      <div class="ch-card-title">${s.title}</div>
      <div class="ch-card-meta">${s.map || ''} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'defense' ? 'Defense' : 'Retake'}</div>
      <p class="ch-card-desc">${s.description || ''}</p>
      <button class="btn-primary ch-card-btn">Voir le guide</button>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => coachingOpenScenarioModal(s));
    list.appendChild(card);
  });
}

function coachingOpenScenarioModal(s) {
  const modal = document.getElementById('ch-scenario-modal');
  if (!modal) return;
  document.getElementById('ch-sm-title').textContent = s.title;
  document.getElementById('ch-sm-badge').textContent = s.rank || '';
  document.getElementById('ch-sm-meta').textContent = `${s.map || ''} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'defense' ? 'Defense' : 'Retake'} \u00b7 Difficulte ${s.difficulty || 3}/5`;
  document.getElementById('ch-sm-guide').textContent = s.guide || 'Guide non disponible.';
  document.getElementById('ch-sm-tips').textContent = s.tips || '';
  // Render tactical map if available
  if (typeof renderTacticalMap === 'function') renderTacticalMap('ch-sm-map', s.id, 0);

  const trainBtn = document.getElementById('ch-sm-train-btn');
  const aimMode = s.aim_mode || s.aimMode;
  const aimDiff = s.aim_diff || s.aimDiff;
  trainBtn.textContent = aimMode ? `S'entrainer (${aimMode.replace('_',' ')})` : "S'entrainer";
  trainBtn.onclick = () => {
    coachingCloseScenarioModal();
    markScenarioCompleted(s.id);
    incrementSessions();
    document.getElementById('coaching-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
    if (aimDiff) document.getElementById('opt-diff').value = aimDiff;
    setTimeout(() => { const btn = document.querySelector(`.mode-card[data-mode="${aimMode}"]`); if (btn) btn.click(); }, 100);
  };

  const completeBtn = document.getElementById('ch-sm-complete-btn');
  const done = getCompletedScenarios().includes(s.id);
  completeBtn.textContent = done ? 'Deja complete' : 'Marquer comme complete';
  completeBtn.disabled = done;
  completeBtn.onclick = () => { markScenarioCompleted(s.id); completeBtn.textContent = 'Deja complete'; completeBtn.disabled = true; };

  // Edit map button -> opens Map Editor with scenario data
  const editMapBtn = document.getElementById('ch-sm-edit-map');
  editMapBtn.onclick = () => {
    coachingCloseScenarioModal();
    meOpenForScenario(s);
  };

  // Reset custom map
  const resetMapBtn = document.getElementById('ch-sm-reset-map');
  const hasCustom = typeof getCustomScenarioMap === 'function' && getCustomScenarioMap(s.id);
  resetMapBtn.style.display = hasCustom ? '' : 'none';
  resetMapBtn.onclick = () => {
    if (confirm('Supprimer ta map personnalisee et revenir a la map par defaut ?')) {
      deleteCustomScenarioMap(s.id);
      if (typeof renderTacticalMap === 'function') renderTacticalMap('ch-sm-map', s.id, 0);
      resetMapBtn.style.display = 'none';
    }
  };

  modal.classList.add('active');
}

function coachingCloseScenarioModal() { document.getElementById('ch-scenario-modal')?.classList.remove('active'); }

// ============ AGENTS ============

function coachingRenderAgents() {
  const role = document.getElementById('ch-agent-role-filter')?.value || '';
  const search = (document.getElementById('ch-agent-search')?.value || '').toLowerCase();
  let filtered = agentsGuide;
  if (role) filtered = filtered.filter(a => a.role === role);
  if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search));

  const list = document.getElementById('ch-agents-list');
  if (!list) return;
  list.innerHTML = '';
  if (!filtered.length) { list.innerHTML = '<p class="ch-empty">Aucun agent trouve.</p>'; return; }

  filtered.forEach(a => {
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = `
      <div class="ch-card-title">${a.name}</div>
      <span class="ch-badge">${a.role}</span>
      <p class="ch-card-desc" style="font-style:italic;margin-top:10px">${a.summary}</p>
      <div class="ch-howto"><strong>Comment jouer :</strong><br>${a.howToPlay}</div>
    `;
    list.appendChild(card);
  });
}

// ============ VODS ============

function coachingRenderVods() {
  const player = document.getElementById('ch-vod-player-filter')?.value || '';
  const agent = document.getElementById('ch-vod-agent-filter')?.value || '';
  const map = document.getElementById('ch-vod-map-filter')?.value || '';

  let filtered = coachingVods;
  if (player) filtered = filtered.filter(v => v.player === player);
  if (agent) filtered = filtered.filter(v => v.agent === agent);
  if (map) filtered = filtered.filter(v => v.map === map);

  const list = document.getElementById('ch-vods-list');
  if (!list) return;
  list.innerHTML = '';
  if (!filtered.length) { list.innerHTML = '<p class="ch-empty">Aucune VOD trouvee.</p>'; return; }

  const watched = getWatchedVods();
  filtered.forEach(v => {
    const seen = watched.includes(v.id);
    const card = document.createElement('div');
    card.className = 'ch-card' + (seen ? ' ch-done' : '');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="ch-card-title" style="margin:0">${v.player} - ${v.agent}</div>
        ${seen ? '<span class="ch-badge-done">Vu</span>' : ''}
      </div>
      <div class="ch-card-meta" style="margin-top:8px">${v.agent} \u00b7 ${v.map} \u00b7 ${v.player}</div>
      <p class="ch-card-desc">${v.channel}</p>
      <button class="btn-primary ch-card-btn">Regarder</button>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => {
      markVodWatched(v.id);
      coachingOpenVodModal(v);
      coachingRenderVods();
    });
    list.appendChild(card);
  });
}

function coachingOpenVodModal(vod) {
  const modal = document.getElementById('ch-vod-modal');
  if (!modal) return;
  document.getElementById('ch-vm-title').textContent = `${vod.player} - ${vod.agent} on ${vod.map}`;
  document.getElementById('ch-vm-iframe').src = `https://www.youtube.com/embed/${vod.youtube_id}?autoplay=1`;
  modal.classList.add('active');
}

function coachingCloseVodModal() {
  const modal = document.getElementById('ch-vod-modal');
  if (modal) { modal.classList.remove('active'); document.getElementById('ch-vm-iframe').src = ''; }
}

// ============ ADMIN: STUDENTS ============

async function coachingRenderStudents() {
  const list = document.getElementById('ch-students-list');
  if (!list) return;
  list.innerHTML = '<p class="ch-empty">Chargement...</p>';

  try {
    const res = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) throw new Error('Erreur chargement');
    const data = await res.json();

    list.innerHTML = '';
    if (!data.students.length) { list.innerHTML = '<p class="ch-empty">Aucun utilisateur.</p>'; return; }

    data.students.forEach(s => {
      const roleLabels = { admin: 'Admin', coach: 'Coach', student: 'Eleve' };
      const card = document.createElement('div');
      card.className = 'ch-card';
      card.innerHTML = `
        <div class="ch-card-title">${s.username}</div>
        <span class="ch-badge role-${s.role}">${roleLabels[s.role] || s.role}</span>
        <div class="ch-card-meta" style="margin-top:8px">${s.email}</div>
        <div class="ch-card-desc">Inscrit le ${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
        ${coachingUserRole === 'admin' ? `
          <select class="ch-role-select" data-user-id="${s.id}" style="margin-top:8px;padding:6px 10px;background:var(--bg);color:var(--txt);border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:0.8rem;width:100%">
            <option value="student" ${s.role==='student'?'selected':''}>Eleve</option>
            <option value="coach" ${s.role==='coach'?'selected':''}>Coach</option>
            <option value="admin" ${s.role==='admin'?'selected':''}>Admin</option>
          </select>
        ` : ''}
      `;
      if (coachingUserRole === 'admin') {
        const select = card.querySelector('.ch-role-select');
        select?.addEventListener('change', async () => {
          try {
            await fetch(`${API_BASE}/update-role`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
              body: JSON.stringify({ userId: s.id, role: select.value })
            });
            coachingRenderStudents();
          } catch (e) { alert('Erreur: ' + e.message); }
        });
      }
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = '<p class="ch-empty">Erreur de chargement.</p>';
  }
}

// ============ ADMIN: MANAGE SCENARIOS ============

function coachingRenderManageScenarios() {
  const list = document.getElementById('ch-manage-scenarios-list');
  if (!list) return;
  list.innerHTML = '';

  coachingScenarios.forEach(s => {
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = `
      <span class="ch-badge">${s.rank || ''}</span>
      <div class="ch-card-title">${s.title}</div>
      <div class="ch-card-meta">${s.map || ''} \u00b7 ${s.type || ''}</div>
      <p class="ch-card-desc">${s.description || ''}</p>
      <button class="btn-primary ch-card-btn" style="margin-top:8px">Editer</button>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => coachingOpenEditModal(s));
    list.appendChild(card);
  });
}

let editingScenarioId = null;

function coachingOpenEditModal(scenario) {
  const modal = document.getElementById('ch-scenario-edit-modal');
  if (!modal) return;

  editingScenarioId = scenario ? scenario.id : null;
  document.getElementById('ch-se-modal-title').textContent = scenario ? 'Editer le scenario' : 'Nouveau scenario';
  document.getElementById('ch-se-title').value = scenario?.title || '';
  document.getElementById('ch-se-rank').value = scenario?.rank || 'BRONZE';
  document.getElementById('ch-se-map').value = scenario?.map || '';
  document.getElementById('ch-se-type').value = scenario?.type || 'attack';
  document.getElementById('ch-se-diff').value = scenario?.difficulty || 3;
  document.getElementById('ch-se-desc').value = scenario?.description || '';
  document.getElementById('ch-se-guide').value = scenario?.guide || '';
  document.getElementById('ch-se-tips').value = scenario?.tips || '';
  document.getElementById('ch-se-aim-mode').value = scenario?.aim_mode || scenario?.aimMode || '';
  document.getElementById('ch-se-aim-diff').value = scenario?.aim_diff || scenario?.aimDiff || 'medium';
  document.getElementById('ch-se-error').style.display = 'none';

  document.getElementById('ch-se-save-btn').onclick = saveScenario;
  modal.classList.add('active');
}

function coachingCloseEditModal() { document.getElementById('ch-scenario-edit-modal')?.classList.remove('active'); }

async function saveScenario() {
  const err = document.getElementById('ch-se-error');
  const data = {
    title: document.getElementById('ch-se-title').value,
    rank: document.getElementById('ch-se-rank').value,
    map: document.getElementById('ch-se-map').value,
    type: document.getElementById('ch-se-type').value,
    difficulty: parseInt(document.getElementById('ch-se-diff').value) || 3,
    description: document.getElementById('ch-se-desc').value,
    guide: document.getElementById('ch-se-guide').value,
    tips: document.getElementById('ch-se-tips').value,
    aim_mode: document.getElementById('ch-se-aim-mode').value,
    aim_diff: document.getElementById('ch-se-aim-diff').value,
  };

  if (!data.title) { err.textContent = 'Titre requis'; err.style.display = 'block'; return; }

  try {
    if (editingScenarioId) {
      data.id = editingScenarioId;
      // Update local
      const idx = coachingScenarios.findIndex(s => s.id === editingScenarioId);
      if (idx !== -1) Object.assign(coachingScenarios[idx], data);
    } else {
      // Create local with temp id
      data.id = Date.now();
      coachingScenarios.push(data);
    }

    coachingCloseEditModal();
    coachingRenderManageScenarios();
    err.style.display = 'none';
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

// ============ MAP EDITOR ============

const ME = {
  currentMap: 'Bind',
  currentTool: 'player_t',
  steps: [{ label:'Step 1', elements:[] }],
  currentStep: 0,
  arrowStart: null, // for 2-click arrow/sightline
  dragging: null, dragIdx: -1,
  editingScenario: null, // { id, title, map } when editing a scenario's map
};

function meInit() {
  const mapSel = document.getElementById('me-map-select');
  const img = document.getElementById('me-map-img');
  const container = document.getElementById('me-canvas-container');

  if (!mapSel || !img || !container) return;

  // Map select
  mapSel.addEventListener('change', () => {
    ME.currentMap = mapSel.value;
    meLoadMapImg();
    meRender();
  });

  // Tool buttons
  document.querySelectorAll('.me-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.me-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ME.currentTool = btn.dataset.tool;
      ME.arrowStart = null;
      container.style.cursor = ME.currentTool === 'eraser' ? 'not-allowed' : 'crosshair';
    });
  });

  // Click on map
  container.addEventListener('mousedown', meOnMouseDown);
  container.addEventListener('mousemove', meOnMouseMove);
  container.addEventListener('mouseup', meOnMouseUp);

  // Steps
  document.getElementById('me-add-step').addEventListener('click', () => {
    ME.steps.push({ label:`Step ${ME.steps.length+1}`, elements:[] });
    ME.currentStep = ME.steps.length - 1;
    meRenderSteps();
    meRender();
  });

  // Save/Clear
  document.getElementById('me-save-strat').addEventListener('click', meSaveStrat);
  document.getElementById('me-clear').addEventListener('click', () => {
    ME.steps = [{ label:'Step 1', elements:[] }];
    ME.currentStep = 0;
    ME.arrowStart = null;
    meRenderSteps();
    meRender();
  });

  meLoadMapImg();
  meRenderSteps();
  meRenderSaved();
}

function meLoadMapImg() {
  const img = document.getElementById('me-map-img');
  const mapData = MAP_DATA[ME.currentMap];
  if (img && mapData) img.src = mapData.img;
}

function meGetCoords(e) {
  const container = document.getElementById('me-canvas-container');
  const img = document.getElementById('me-map-img');
  const rect = img.getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) / rect.width) * 1024);
  const y = Math.round(((e.clientY - rect.top) / rect.height) * 1024);
  return { x: Math.max(0, Math.min(1024, x)), y: Math.max(0, Math.min(1024, y)) };
}

function meOnMouseDown(e) {
  if (e.button !== 0) return;
  const { x, y } = meGetCoords(e);
  const step = ME.steps[ME.currentStep];
  if (!step) return;

  const tool = ME.currentTool;

  // Eraser: find and remove nearest element
  if (tool === 'eraser') {
    let bestIdx = -1, bestDist = 40;
    step.elements.forEach((el, i) => {
      const ex = el.x ?? ((el.x1 + el.x2) / 2);
      const ey = el.y ?? ((el.y1 + el.y2) / 2);
      const d = Math.hypot(ex - x, ey - y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx >= 0) { step.elements.splice(bestIdx, 1); meRender(); }
    return;
  }

  // Arrow/sightline: 2-click mode
  if (tool === 'arrow' || tool === 'sightline') {
    if (!ME.arrowStart) {
      ME.arrowStart = { x, y };
      return;
    }
    const el = tool === 'arrow'
      ? { type:'arrow', x1:ME.arrowStart.x, y1:ME.arrowStart.y, x2:x, y2:y, color:'#3fb950' }
      : { type:'sightline', x1:ME.arrowStart.x, y1:ME.arrowStart.y, x2:x, y2:y };
    step.elements.push(el);
    ME.arrowStart = null;
    meRender();
    return;
  }

  // Text: prompt for label
  if (tool === 'text') {
    const label = prompt('Texte:');
    if (label) { step.elements.push({ type:'text', x, y, label }); meRender(); }
    return;
  }

  // Check if clicking near existing element to drag
  let dragIdx = -1, dragDist = 30;
  step.elements.forEach((el, i) => {
    if (el.x !== undefined) {
      const d = Math.hypot(el.x - x, el.y - y);
      if (d < dragDist) { dragDist = d; dragIdx = i; }
    }
  });

  if (dragIdx >= 0 && tool !== 'eraser') {
    ME.dragging = step.elements[dragIdx];
    ME.dragIdx = dragIdx;
    return;
  }

  // Place new element
  let newEl = null;
  switch (tool) {
    case 'player_t': newEl = { type:'player', x, y, team:'T', label:'ATK' }; break;
    case 'player_ct': newEl = { type:'player', x, y, team:'CT', label:'DEF' }; break;
    case 'smoke': newEl = { type:'smoke', x, y, label:'Smoke' }; break;
    case 'flash': newEl = { type:'flash', x, y }; break;
    case 'plant': newEl = { type:'plant', x, y }; break;
  }
  if (newEl) { step.elements.push(newEl); meRender(); }
}

function meOnMouseMove(e) {
  if (!ME.dragging) return;
  const { x, y } = meGetCoords(e);
  ME.dragging.x = x;
  ME.dragging.y = y;
  meRender();
}

function meOnMouseUp() {
  ME.dragging = null;
  ME.dragIdx = -1;
}

function meRender() {
  const svg = document.getElementById('me-svg-overlay');
  if (!svg) return;
  const step = ME.steps[ME.currentStep];
  if (!step) { svg.innerHTML = ''; return; }

  let out = '';
  step.elements.forEach(el => {
    switch (el.type) {
      case 'smoke':
        out += `<circle cx="${el.x}" cy="${el.y}" r="36" fill="rgba(150,150,150,0.45)" stroke="#bbb" stroke-width="2.5" stroke-dasharray="8"/>`;
        if (el.label) out += `<text x="${el.x}" y="${el.y+5}" fill="#ddd" font-size="18" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 6px #000">${el.label}</text>`;
        break;
      case 'flash':
        out += `<circle cx="${el.x}" cy="${el.y}" r="20" fill="rgba(255,220,50,0.6)" stroke="#ffdd33" stroke-width="2.5"/>`;
        out += `<text x="${el.x}" y="${el.y+7}" fill="#fff" font-size="18" text-anchor="middle" font-weight="bold">F</text>`;
        break;
      case 'player':
        const c = el.team === 'T' ? '#ff4655' : '#58a6ff';
        out += `<circle cx="${el.x}" cy="${el.y}" r="20" fill="${c}" stroke="#fff" stroke-width="3" opacity="0.9"/>`;
        if (el.label) out += `<text x="${el.x}" y="${el.y+45}" fill="${c}" font-size="18" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 6px #000">${el.label}</text>`;
        break;
      case 'arrow':
        const ac = el.color || '#3fb950';
        const aid = `me-ah-${el.x1}-${el.y1}-${el.x2}`;
        out += `<defs><marker id="${aid}" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto"><polygon points="0 0,12 4,0 8" fill="${ac}"/></marker></defs>`;
        out += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${ac}" stroke-width="4" marker-end="url(#${aid})" opacity="0.85"/>`;
        break;
      case 'sightline':
        out += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="rgba(255,70,85,0.5)" stroke-width="2.5" stroke-dasharray="10"/>`;
        break;
      case 'plant':
        out += `<rect x="${el.x-15}" y="${el.y-15}" width="30" height="30" fill="rgba(255,70,85,0.7)" stroke="#ff4655" stroke-width="3" rx="4"/>`;
        out += `<text x="${el.x}" y="${el.y+7}" fill="#fff" font-size="18" text-anchor="middle" font-weight="bold">X</text>`;
        break;
      case 'text':
        out += `<text x="${el.x}" y="${el.y}" fill="#ffcc44" font-size="22" text-anchor="middle" font-weight="bold" style="text-shadow:0 0 8px #000">${el.label}</text>`;
        break;
    }
  });

  // Show arrow start indicator
  if (ME.arrowStart) {
    out += `<circle cx="${ME.arrowStart.x}" cy="${ME.arrowStart.y}" r="8" fill="none" stroke="#3fb950" stroke-width="3" stroke-dasharray="4"><animate attributeName="r" values="8;14;8" dur="1s" repeatCount="indefinite"/></circle>`;
  }

  svg.innerHTML = out;
}

function meRenderSteps() {
  const list = document.getElementById('me-steps-list');
  if (!list) return;
  list.innerHTML = '';
  ME.steps.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'me-step-btn' + (i === ME.currentStep ? ' active' : '');
    btn.innerHTML = s.label;
    if (ME.steps.length > 1) {
      btn.innerHTML += ` <span class="me-step-del" data-idx="${i}">&times;</span>`;
    }
    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('me-step-del')) {
        ME.steps.splice(parseInt(e.target.dataset.idx), 1);
        if (ME.currentStep >= ME.steps.length) ME.currentStep = ME.steps.length - 1;
        meRenderSteps();
        meRender();
        return;
      }
      ME.currentStep = i;
      ME.arrowStart = null;
      meRenderSteps();
      meRender();
    });
    list.appendChild(btn);
  });
}

function meSaveStrat() {
  const nameInput = document.getElementById('me-strat-name');
  const name = (nameInput.value || '').trim() || `Strat ${Date.now()}`;
  const strats = meGetSaved();
  strats.push({
    name,
    map: ME.currentMap,
    steps: JSON.parse(JSON.stringify(ME.steps)),
    date: new Date().toISOString()
  });
  localStorage.setItem('me_strats', JSON.stringify(strats));
  nameInput.value = '';
  meRenderSaved();
}

function meGetSaved() {
  try { return JSON.parse(localStorage.getItem('me_strats')) || []; } catch { return []; }
}

function meLoadStrat(idx) {
  const strats = meGetSaved();
  const s = strats[idx];
  if (!s) return;
  ME.currentMap = s.map;
  ME.steps = JSON.parse(JSON.stringify(s.steps));
  ME.currentStep = 0;
  ME.arrowStart = null;
  document.getElementById('me-map-select').value = s.map;
  meLoadMapImg();
  meRenderSteps();
  meRender();
}

function meDeleteStrat(idx) {
  const strats = meGetSaved();
  strats.splice(idx, 1);
  localStorage.setItem('me_strats', JSON.stringify(strats));
  meRenderSaved();
}

function meRenderSaved() {
  const list = document.getElementById('me-saved-list');
  if (!list) return;
  const strats = meGetSaved();
  if (!strats.length) { list.innerHTML = '<span style="color:var(--dim);font-size:0.8rem">Aucune strat sauvegardee</span>'; return; }
  list.innerHTML = '';
  strats.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'me-saved-item';
    item.innerHTML = `<span style="font-weight:700">${s.name}</span> <span style="color:var(--dim);font-size:0.7rem">${s.map}</span> <span class="me-del" data-idx="${i}">&times;</span>`;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('me-del')) { meDeleteStrat(parseInt(e.target.dataset.idx)); return; }
      meLoadStrat(i);
    });
    list.appendChild(item);
  });
}

// Open Map Editor pre-loaded with a scenario's map data
function meOpenForScenario(scenario) {
  ME.editingScenario = { id: scenario.id, title: scenario.title, map: scenario.map || 'Bind' };

  // Load existing custom annotations, or default annotations, or start fresh
  const custom = typeof getCustomScenarioMap === 'function' && getCustomScenarioMap(scenario.id);
  const defaults = typeof SCENARIO_ANNOTATIONS !== 'undefined' && SCENARIO_ANNOTATIONS[scenario.id];
  const source = custom || defaults;

  ME.currentMap = source ? source.map : (scenario.map || 'Bind');
  ME.steps = source ? JSON.parse(JSON.stringify(source.steps)) : [{ label:'Step 1', elements:[] }];
  ME.currentStep = 0;
  ME.arrowStart = null;

  document.getElementById('me-map-select').value = ME.currentMap;

  // Switch to map editor tab
  coachingSwitchTab('ch-map-editor');

  // Show scenario banner + save button
  meUpdateScenarioBanner();
  meLoadMapImg();
  meRenderSteps();
  meRender();
}

function meUpdateScenarioBanner() {
  let banner = document.getElementById('me-scenario-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'me-scenario-banner';
    banner.style.cssText = 'padding:10px 16px;background:rgba(255,70,85,0.1);border:1px solid var(--accent);border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap';
    const toolbar = document.querySelector('.me-toolbar');
    if (toolbar) toolbar.parentNode.insertBefore(banner, toolbar);
  }

  if (!ME.editingScenario) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  banner.innerHTML = `
    <div>
      <span style="font-size:0.75rem;color:var(--dim)">Edition de la map pour :</span>
      <strong style="color:var(--accent);margin-left:6px">${ME.editingScenario.title}</strong>
    </div>
    <div style="display:flex;gap:8px">
      <button id="me-save-scenario-map" class="btn-primary" style="padding:8px 18px;font-size:0.8rem">Sauvegarder pour ce scenario</button>
      <button id="me-cancel-scenario" class="btn-secondary" style="padding:8px 14px;font-size:0.8rem">Annuler</button>
    </div>
  `;

  document.getElementById('me-save-scenario-map').addEventListener('click', () => {
    const s = ME.editingScenario;
    if (!s) return;
    saveCustomScenarioMap(s.id, ME.currentMap, JSON.parse(JSON.stringify(ME.steps)));
    ME.editingScenario = null;
    meUpdateScenarioBanner();
    // Go back to scenarios tab
    coachingSwitchTab('ch-scenarios');
  });

  document.getElementById('me-cancel-scenario').addEventListener('click', () => {
    ME.editingScenario = null;
    meUpdateScenarioBanner();
    coachingSwitchTab('ch-scenarios');
  });
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', () => {
  initGlobalAuth();
  initCoaching();
  meInit();
});
