// ============ COACHING HUB ============

// API base (Netlify Functions)
const API_BASE = '/.netlify/functions';

let coachingUser = null;
let coachingUserRole = null;
let coachingToken = null;

// Restore token from localStorage
(function restoreSession() {
  const saved = localStorage.getItem('ch_token');
  if (saved) coachingToken = saved;
})();

// ============ LOCAL STORAGE TRACKING ============

function getWatchedVods() {
  try { return JSON.parse(localStorage.getItem('ch_watched_vods')) || []; } catch { return []; }
}
function markVodWatched(id) {
  const w = getWatchedVods();
  if (!w.includes(id)) { w.push(id); localStorage.setItem('ch_watched_vods', JSON.stringify(w)); }
}
function getCompletedScenarios() {
  try { return JSON.parse(localStorage.getItem('ch_completed_scenarios')) || []; } catch { return []; }
}
function markScenarioCompleted(id) {
  const c = getCompletedScenarios();
  if (!c.includes(id)) { c.push(id); localStorage.setItem('ch_completed_scenarios', JSON.stringify(c)); }
}
function getSessionCount() {
  return parseInt(localStorage.getItem('ch_sessions') || '0');
}
function incrementSessions() {
  localStorage.setItem('ch_sessions', String(getSessionCount() + 1));
}

// ============ DATA: AGENTS ============

const agentsGuide = [
  // Controllers
  { name: 'Brimstone', role: 'Controller', summary: "Controleur fiable avec 3 smokes longue duree et un ulti devastateur. Ideal pour organiser des executes coordonnees et dominer le post-plant grace a ses mollys.", howToPlay: "En attaque : place tes 3 smokes sur les crossfires cles du site vise, puis entre avec ton equipe. En defense : garde 1-2 smokes pour les retakes. Ton ulti + molly = combo imbattable pour deny le defuse. Joue toujours en soutien, jamais en first." },
  { name: 'Omen', role: 'Controller', summary: "Controleur versatile qui excelle dans la deception. Ses smokes se rechargent, son TP permet des repositionnements imprevus, et son ulti cree une pression globale.", howToPlay: "Place tes smokes en profondeur pour isoler les duels (one-way si possible). Utilise tes TP pour changer d'angle apres chaque kill - ne reste jamais au meme endroit. En mid-round, flanke avec ton TP pour backstab. Ton ulti est parfait pour info ou retakes surprise." },
  { name: 'Viper', role: 'Controller', summary: "Specialiste du controle toxique avec un mur et un orbe qui drainent la vie. Imbattable en post-plant et sur les maps avec de longues lignes de vue. Son ulti cree une zone de mort.", howToPlay: "Apprends 2-3 line-ups de mur et de molly par map (indispensable). Garde ton fuel pour les moments critiques (plant, retake). En post-plant : molly le spike + mur pour couper les angles. Son ulti en defense transforme un site entier en forteresse." },
  { name: 'Astra', role: 'Controller', summary: "Controleur strategique a l'echelle globale. Place ses etoiles depuis la vue astrale pour creer smokes, stuns, et aspirations n'importe ou sur la map.", howToPlay: "Avant le round : place tes etoiles sur les choke points et positions standards. Pull pour stopper les rushes, stun pour ouvrir les sites. Communique en permanence avec ton equipe - Astra est inutile sans coordination. Garde 1-2 etoiles pour les imprevisibles." },
  { name: 'Harbor', role: 'Controller', summary: "Controleur dynamique dont le mur d'eau mobile accompagne les pushes. Ses cascades ralentissent les ennemis et son ulti force les sorties de cover.", howToPlay: "Lance ton mur pour accompagner le rush de ton equipe - il couvre les angles pendant qu'ils avancent. Les cascades servent a ralentir les rotations ou les retakes. En defense, utilise le mur pour couper les entrees. L'ulti est devastateur sur les sites fermes (B Bind, B Split)." },
  { name: 'Clove', role: 'Controller', summary: "Controleur agressif unique qui peut poser des smokes meme apres sa mort. Son kit encourage un style de jeu offensif avec heal sur kill et survie temporaire.", howToPlay: "Joue plus agressif qu'un controleur classique - prends des duels avec ton equipe. Apres un kill, utilise ton heal. Si tu meurs pendant une execute, pose immediatement tes smokes depuis la mort pour finir le round. Ton auto-rez temporaire est parfait pour creer du chaos." },
  // Duelists
  { name: 'Jett', role: 'Duelist', summary: "Entry fragger aerienne avec une mobilite sans egale. Son dash permet des peeks agressifs sans risque, et ses couteaux sont mortels a toute distance.", howToPlay: "Prepare TOUJOURS ton dash avant un peek agressif - c'est ton assurance vie. Entre en premier avec l'util de tes mates (flash, drone). Apres un kill, dash pour eviter le trade. Avec l'Op, prends des lignes agressives puis dash en arriere. Tes couteaux sont parfaits pour l'eco." },
  { name: 'Reyna', role: 'Duelist', summary: "Duelist purement orientee combat 1v1 qui snowball sur ses kills. Chaque elimination offre un choix : devenir invulnerable ou se soigner completement.", howToPlay: "Ne prends JAMAIS un duel sans orbe de vision disponible. Apres chaque kill, decide en une seconde : dismiss pour sortir d'une position dangereuse, ou heal pour rester agressif. Son flash est la meilleure pour les peeks solo. L'ulti est un gamechanger - utilise-le des qu'il est pret pour snowball." },
  { name: 'Raze', role: 'Duelist', summary: "Duelist explosive specialisee dans le nettoyage de zone. Ses satchels offrent une mobilite aerienne unique, sa nade force les repositionnements, et son ulti est un kill garanti.", howToPlay: "Ouvre chaque round avec ta nade sur les positions standards (corners, derriere les boxes). Double satchel pour entrer sur site par les airs - un angle impossible a tenir. Le boombot clear les flanks. Ton ulti doit garantir un kill decisif (anchor, oppeur, clutcher). Travaille les combos satchel + ulti aeriens." },
  { name: 'Phoenix', role: 'Duelist', summary: "Duelist auto-suffisant avec flashs, mur de feu et molly de soin. Son ulti lui permet de prendre des infos ou entrer sur site sans aucun risque.", howToPlay: "Ta flash courbe est parfaite pour les peeks solo - curve-la pour ne pas aveugler tes mates. Utilise mur + molly pour te soigner entre les duels (40hp de heal gratuit). Ton ulti est un entry parfait : rush le site, prends les infos/kills, et reviens en safety. N'oublie pas que le mur bloque aussi la vision." },
  { name: 'Yoru', role: 'Duelist', summary: "Duelist furtif specialise dans les flanks, les fakes et les timings inattendus. Son TP et son ulti d'invisibilite creent des situations impossibles a anticiper.", howToPlay: "Pre-place ton TP dans une position safe avant d'engager. Combine faux pas + TP pour fake un push pendant que tu flankes par l'autre cote. En ulti : prends l'info deep sur le site, appelle les positions, puis backstab pendant que ton equipe entre. Le timing de sortie d'ulti est la cle." },
  { name: 'Neon', role: 'Duelist', summary: "Duelist a haute velocite qui casse tous les timings. Son sprint et son slide la rendent quasi impossible a toucher, et son ulti electrique shred a courte portee.", howToPlay: "Utilise ton mur pour creer un couloir d'entree safe, puis slide pour prendre le site. Ne cours jamais en ligne droite - zigzague. Travaille tes routes d'entree par map pour surprendre. L'ulti est devastateur dans les espaces fermes. Combine slide + peek pour des angles impossibles. Economise ton sprint pour les timings critiques." },
  { name: 'Iso', role: 'Duelist', summary: "Duelist methodique qui excelle dans les duels isoles. Son bouclier absorbe un tir mortel, et son ulti force un 1v1 dans une dimension parallele.", howToPlay: "Active ton bouclier avant chaque peek pour absorber le premier tir ennemi - ca retourne completement les duels. L'ulti cible les joueurs problematiques : l'oppeur qui bloque le site, l'anchor sur le point, ou le clutcher en fin de round. Joue methodique, un duel a la fois, pas de multi-peek." },
  { name: 'Miks', role: 'Duelist', summary: "Duelist tactique avec des capacites de disruption sonore. Ses abilities desorientent les ennemis et creent des ouvertures pour son equipe.", howToPlay: "Utilise tes capacites sonores pour deorienter les defenseurs avant d'entrer. Combine tes disruptions avec les flashs de tes initiators pour un entry devastateur. En defense, tes abilities sont excellentes pour retarder les pushes et forcer les ennemis a ralentir. Adapte ton style selon la composition adverse." },
  // Initiators
  { name: 'Sova', role: 'Initiator', summary: "Initiator d'info supreme avec drone et fleche de recon. Ses line-ups de fleche revelent des sites entiers, son drone clear les angles dangereux, et son ulti perce les murs.", howToPlay: "Apprends 3-5 line-ups de fleche par map (non negociable). Drone AVANT que tes duelists entrent pour clear les close angles. Garde les shock darts pour le post-plant (line-ups de deny defuse). Ton ulti traverse les murs : utilise-le pour finir les low HP, deny le plant/defuse, ou casser un stack." },
  { name: 'Skye', role: 'Initiator', summary: "Initiator hybride avec flash guidee, chien eclaireur et heal d'equipe. La plus polyvalente des initiators - info, flash, et sustain en un seul kit.", howToPlay: "Pop-flash TOUJOURS pour tes duelists - annonce a chaque fois. Ton chien clear les zones dangereuses avant un push ou retake (il tag les ennemis). Le heal est precieux : priorise les joueurs a bas HP avant les fights. Tes flashs donnent de l'info meme si elles ne touchent personne (confirmation visuelle)." },
  { name: 'Fade', role: 'Initiator', summary: "Initiator qui traque et paralyse les ennemis. Sa haunt revele leur position, ses snares les immobilisent, et son ulti terrorise une zone entiere.", howToPlay: "Lance ta haunt au debut de chaque execute pour reveler les positions ennemies. Les snares sur les choke points punissent les pushes et les rotations. Synchronise toujours ta haunt avec l'entree de ton equipe. L'ulti est parfait pour les retakes sur les sites fermes - il rend sourd et revele." },
  { name: 'KAY/O', role: 'Initiator', summary: "Initiator anti-capacites qui neutralise l'util ennemi dans une zone. Ses flashs sont les plus rapides du jeu, et son ulti supprime les abilities en continu.", howToPlay: "Lance ton knife de suppression AVANT l'execute pour desactiver les sorts defensifs (trips KJ, cam Cypher, etc). Tes flashs sont rapides - right-click pour pop-flash, left-click pour long range. En ulti, tu supprimes tout dans un rayon - entre en premier car tu peux te faire revive. Appelle toujours les ennemis supprimes." },
  { name: 'Breach', role: 'Initiator', summary: "Initiator de breche qui traverse les murs avec stuns, flashs et tremblements. Imbattable pour ouvrir les espaces confines et casser les crossfires.", howToPlay: "Coordonne TOUJOURS tes stuns avec l'entry de ton duelist - timing est tout. Ne stun jamais sans prevenir. Tes flashs traversent les murs - parfait pour les sites etroits. L'ulti est devastateur sur les petits sites (B Bind, B Split). En retake, enchaine stun + flash + ulti pour une ouverture garantie." },
  { name: 'Gekko', role: 'Initiator', summary: "Initiator polyvalent avec des creatures recuperables. Stun, flash, molly et un ulti qui plante/defuse a ta place. Le meilleur pick pour jouer solo-queue.", howToPlay: "Mosh pit sur les coins standards pour deloger (il est enorme). Wingman peut planter ou defuser le spike pendant que tu couvres - game changer en clutch. Recupere TOUJOURS tes creatures apres utilisation pour les reutiliser. Dizzy (flash) au-dessus des murs pour reveler + aveugler." },
  // Sentinels
  { name: 'Sage', role: 'Sentinel', summary: "Sentinel de soutien avec mur, slows et resurrection. Son mur cree des nouvelles lignes de vue, ses slows retardent tout, et son rez change le cours des rounds.", howToPlay: "Le mur peut bloquer les rushs OU creer des angles eleves pour peek. Garde un slow pour deny le plant/retake. Ton rez doit changer le round : priorise l'oppeur, l'anchor ou l'entry fragger. Ne gaspille JAMAIS le rez sur quelqu'un en position exposee. En attaque, le mur sur site cree du cover pour planter." },
  { name: 'Killjoy', role: 'Sentinel', summary: "Sentinel de zone avec tourelle, alarmbots et nanoswarms. La meilleure pour anchor un site en solo et dominer le post-plant avec ses grenades.", howToPlay: "Setup ta tourelle + alarmbot pour couvrir l'entree principale. Les nanoswarms sous le spike = deny defuse garanti (apprends les spots). Change tes setups regulierement pour ne pas etre previsible. L'ulti force les ennemis a quitter le site - parfait pour reprendre le controle. Attention au range de desactivation." },
  { name: 'Cypher', role: 'Sentinel', summary: "Sentinel d'information avec camera, trips et cage. Le roi de la surveillance - ses traps donnent de l'info en permanence et son ulti revele toute l'equipe ennemie.", howToPlay: "Camera + trips sur les points d'entree cles. Donne l'info DES que tu detectes quelque chose - meme un bruit. Change tes placements de trip chaque round. En attaque, securise les flanks avec trips pour liberer tes duelists. L'ulti sur un corps = position de TOUTE l'equipe ennemie revelee." },
  { name: 'Chamber', role: 'Sentinel', summary: "Sentinel orientee duel avec TP defensif et armes de precision. Excelle en hold longue distance avec l'Op et peut decrocher instantanement grace a son TP.", howToPlay: "Place ton TP avant de prendre une ligne agressive. Apres un kill, TP IMMEDIATEMENT pour eviter le trade - c'est ta signature. Tes traps couvrent l'autre cote de la map pendant que tu hold. Le Headhunter est parfait en eco. L'ulti (Tour de Force) est un Op gratuit - utilise-le pour l'economie de l'equipe." },
];

// ============ DATA: SCENARIOS ============

const defaultScenarios = [
  // IRON-BRONZE
  { id: 1, title: "B Site Take - Bind", rank: "BRONZE", map: "Bind", type: "attack", difficulty: 1,
    description: "Entree B simple avec smoke et flash.",
    guide: "1. Smoke hookah et long B\n2. Flash pour ton duelist\n3. Le duelist entre par short B\n4. Le second joueur clear garden\n5. Plante default (derriere le pilier)",
    tips: "Ne rush jamais sans smokes. Toujours clear les coins un par un. Le plant default permet de defendre depuis hookah.",
    aimMode: "pasu_reload", aimDiff: "easy" },
  { id: 2, title: "A Site Hold - Ascent", rank: "BRONZE", map: "Ascent", type: "defense", difficulty: 1,
    description: "Defense du site A avec crossfire basique.",
    guide: "1. Un joueur tient le generator\n2. Un joueur tient heaven/rafters\n3. Le crossfire couvre main et short\n4. Si push : call et rotate\n5. Ne peek pas seul si avantage en nombre",
    tips: "Le crossfire generator + heaven est tres puissant. Ne donnez jamais de trade gratuit. Retombez sur site si vous perdez le premier duel.",
    aimMode: "speedflick", aimDiff: "easy" },
  // SILVER
  { id: 3, title: "A Site Retake - Haven", rank: "SILVER", map: "Haven", type: "retake", difficulty: 2,
    description: "Retake du site A apres plant ennemi.",
    guide: "1. Regroupe-toi avec ton equipe (ne retake pas seul)\n2. Utilise les utils pour clear les positions classiques\n3. Flash/stun long A et sewers\n4. Peek ensemble (swing synchronise)\n5. Check le timer avant de defuse",
    tips: "Le timing est crucial en retake. Utilise tes utils pour egaliser les chances. Defuse toujours a couvert si possible.",
    aimMode: "pasu_reload", aimDiff: "medium" },
  { id: 4, title: "Mid Control - Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2,
    description: "Prise du mid pour ouvrir les rotations.",
    guide: "1. Smoke vent et mail\n2. Clear mid avec drone/flash\n3. Un joueur hold mid bottom\n4. Decide A ou B selon l'info\n5. Execute rapidement apres la prise",
    tips: "Le mid de Split est la cle de la map. Celui qui controle le mid controle le round. Ne restez pas plantes au mid trop longtemps.",
    aimMode: "pokeball_frenzy", aimDiff: "medium" },
  // GOLD
  { id: 5, title: "2v5 Clutch - Split", rank: "GOLD", map: "Split", type: "attack", difficulty: 3,
    description: "Situation de desavantage numerique.",
    guide: "1. Ne panic pas - evalue la situation\n2. Note les positions connues des ennemis\n3. Isole tes duels (1v1 toujours)\n4. Utilise le temps et le son\n5. Joue imprevisible - change de site si besoin",
    tips: "En clutch, l'information sonore est reine. Marche, ecoute, et prends des duels isoles. Ne te precipite jamais sauf si le timer l'exige.",
    aimMode: "speedflick", aimDiff: "medium" },
  { id: 6, title: "B Execute - Haven", rank: "GOLD", map: "Haven", type: "attack", difficulty: 3,
    description: "Execute coordonnee sur B avec util complete.",
    guide: "1. Smoke window et CT\n2. Flash par-dessus le mur\n3. Molly le back site\n4. Entry par main et garden simultanement\n5. Plante pour long B",
    tips: "L'execute doit etre rapide et synchronisee. Si les smokes tombent avant que tu entres, tu es mort. Communique le timing exact.",
    aimMode: "gridshot", aimDiff: "medium" },
  // PLATINUM
  { id: 7, title: "Post-Plant Defense - Ascent", rank: "PLATINUM", map: "Ascent", type: "attack", difficulty: 4,
    description: "Tenir le post-plant avec mollys et util.",
    guide: "1. Plante default (safe pour lineup)\n2. Recule hors du site\n3. Utilise les mollys/nades pour deny le defuse\n4. Joue le temps - le spike est ton allie\n5. Ne repeek que si necessaire",
    tips: "En post-plant, le temps joue pour toi. Chaque seconde que tu gagnes avec tes utils reduit la fenetre de defuse. Apprends les lineups de molly par agent.",
    aimMode: "air_angelic", aimDiff: "hard" },
  { id: 8, title: "Fake + Rotate - Lotus", rank: "PLATINUM", map: "Lotus", type: "attack", difficulty: 4,
    description: "Fake un site puis execute sur un autre.",
    guide: "1. Envoie 1-2 utils sur A (smoke, flash)\n2. Fait du bruit pour attirer la rotation\n3. Regroupe silencieusement vers C\n4. Attend 5-10 secondes (rotation ennemie)\n5. Execute C rapidement",
    tips: "Le fake doit etre credible mais pas trop couteux en util. Garde la majorite de tes utils pour la vraie execute. Le timing de rotation est la cle.",
    aimMode: "pokeball_frenzy", aimDiff: "hard" },
  // DIAMOND
  { id: 9, title: "Full Execute - Lotus", rank: "DIAMOND", map: "Lotus", type: "attack", difficulty: 5,
    description: "Execute complete sur A site avec 5 joueurs.",
    guide: "1. Drone/haunt pour reveler les positions\n2. Smokes sur tree et rubble\n3. Flash + stun simultanement\n4. Entry par main + root\n5. Plant default, setup post-plant positions",
    tips: "Une execute parfaite necessite une coordination parfaite. Chaque joueur a un role precis. Le timing des utils doit etre au dixieme de seconde pres.",
    aimMode: "gridshot", aimDiff: "hard" },
  { id: 10, title: "Anti-Eco Management", rank: "DIAMOND", map: "Ascent", type: "defense", difficulty: 5,
    description: "Gerer un round d'anti-eco sans donner de kills.",
    guide: "1. Ne push PAS - laisse-les venir a toi\n2. Garde les distances (pas de close range)\n3. Utilise tes utils pour ralentir\n4. Crossfire les entrees\n5. Trade immediatement si un mate tombe",
    tips: "Le pire en anti-eco est de donner des armes a l'ennemi. Joue safe, garde les distances, et ne sous-estime jamais un joueur eco avec un Sheriff.",
    aimMode: "whisphere", aimDiff: "medium" },
];

// ============ DATA: VODS ============

const defaultVods = [
  { id: "v1", title: "S0m - Tejo on Pearl", player: "S0m", agent: "Tejo", map: "Pearl", channel: "Valorant Daily", youtube_id: "cXnVZDJeBOk" },
  { id: "v2", title: "S0m - Astra on Pearl", player: "S0m", agent: "Astra", map: "Pearl", channel: "Valorant Daily", youtube_id: "6ikcUzOGNlk" },
  { id: "v3", title: "Oxy - Waylay on Haven", player: "Oxy", agent: "Waylay", map: "Haven", channel: "Valorant Daily", youtube_id: "wNLEpJTrQfk" },
  { id: "v4", title: "Aleksander - Astra on Split", player: "Aleksander", agent: "Astra", map: "Split", channel: "Valorant Pro", youtube_id: "dQw4w9WgXcQ" },
  { id: "v5", title: "Brawk - Chamber on Ascent", player: "Brawk", agent: "Chamber", map: "Ascent", channel: "Valorant Pro", youtube_id: "jNQXAC9IVRw" },
  { id: "v6", title: "Kajaak - Sage on Lotus", player: "Kajaak", agent: "Sage", map: "Lotus", channel: "Valorant Daily", youtube_id: "9bZkp7q19f0" },
  { id: "v7", title: "nAts - Cypher on Bind", player: "nAts", agent: "Cypher", map: "Bind", channel: "Valorant Pro", youtube_id: "kJQP7kiw9Fk" },
  { id: "v8", title: "Jinggg - Raze on Breeze", player: "Jinggg", agent: "Raze", map: "Breeze", channel: "Valorant Daily", youtube_id: "L0MK7qz13bU" },
  { id: "v9", title: "Zekken - Jett on Split", player: "Zekken", agent: "Jett", map: "Split", channel: "Valorant Pro", youtube_id: "aqz-KE-bpKQ" },
  { id: "v10", title: "WoOt - Viper on Haven", player: "WoOt", agent: "Viper", map: "Haven", channel: "Valorant Daily", youtube_id: "DLzxrzFCyEc" },
  { id: "v11", title: "Zander - Fade on Sunset", player: "Zander", agent: "Fade", map: "Sunset", channel: "Valorant Pro", youtube_id: "2Xc3p4NBGC4" },
  { id: "v12", title: "Demon1 - Iso on Fracture", player: "Demon1", agent: "Iso", map: "Fracture", channel: "Valorant Daily", youtube_id: "V7ScGV5128A" },
  { id: "v13", title: "TenZ - Jett on Ascent", player: "TenZ", agent: "Jett", map: "Ascent", channel: "Valorant Pro", youtube_id: "hY7m5jjJ9mM" },
  { id: "v14", title: "Aspas - Raze on Bind", player: "Aspas", agent: "Raze", map: "Bind", channel: "Valorant Pro", youtube_id: "ZZ5LpwO-An4" },
  { id: "v15", title: "Chronicle - Omen on Haven", player: "Chronicle", agent: "Omen", map: "Haven", channel: "Valorant Daily", youtube_id: "kfVsfOSbJY0" },
  { id: "v16", title: "Derke - Chamber on Breeze", player: "Derke", agent: "Chamber", map: "Breeze", channel: "Valorant Pro", youtube_id: "QH2-TGUlwu4" },
];

let coachingScenarios = defaultScenarios;
let coachingVods = defaultVods;

// ============ INIT ============

function initCoaching() {
  document.getElementById('btn-coaching').addEventListener('click', () => {
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('coaching-screen').classList.add('active');
    coachingUpdateAuthUI();
  });

  document.getElementById('btn-coaching-back').addEventListener('click', () => {
    coachingCloseVodModal();
    coachingCloseScenarioModal();
    document.getElementById('coaching-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
  });

  // Tab buttons
  document.querySelectorAll('.ch-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => coachingSwitchTab(btn.dataset.tab));
  });

  // Auth
  document.getElementById('ch-login-btn')?.addEventListener('click', coachingLogin);
  document.getElementById('ch-register-btn')?.addEventListener('click', coachingRegister);
  document.getElementById('ch-toggle-register')?.addEventListener('click', () => coachingToggleAuth('register'));
  document.getElementById('ch-toggle-login')?.addEventListener('click', () => coachingToggleAuth('login'));
  document.getElementById('ch-logout-btn')?.addEventListener('click', coachingLogout);

  // Filters
  document.getElementById('ch-rank-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-map-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-type-filter')?.addEventListener('change', coachingRenderScenarios);
  document.getElementById('ch-agent-role-filter')?.addEventListener('change', coachingRenderAgents);
  document.getElementById('ch-agent-search')?.addEventListener('input', coachingRenderAgents);
  document.getElementById('ch-vod-player-filter')?.addEventListener('change', coachingRenderVods);
  document.getElementById('ch-vod-agent-filter')?.addEventListener('change', coachingRenderVods);
  document.getElementById('ch-vod-map-filter')?.addEventListener('change', coachingRenderVods);

  // Modal close on backdrop click
  document.getElementById('ch-vod-modal')?.addEventListener('click', e => {
    if (e.target.id === 'ch-vod-modal') coachingCloseVodModal();
  });
  document.getElementById('ch-scenario-modal')?.addEventListener('click', e => {
    if (e.target.id === 'ch-scenario-modal') coachingCloseScenarioModal();
  });

  coachingCheckSession();
}

// ============ AUTH ============

async function coachingCheckSession() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      coachingUser = data.user;
      coachingUserRole = data.user.role;
      document.getElementById('ch-user-info').textContent = data.user.email + (data.user.role === 'admin' ? ' (Coach)' : ' (Eleve)');
      coachingUpdateAuthUI();
    } else {
      // Token expired/invalid
      localStorage.removeItem('ch_token');
      coachingToken = null;
    }
  } catch (e) { /* ignore */ }
}

function coachingUpdateAuthUI() {
  const authForms = document.getElementById('ch-auth-forms');
  const authLogged = document.getElementById('ch-auth-logged');
  const content = document.getElementById('ch-content');
  const authGate = document.getElementById('ch-auth-gate');

  if (coachingUser) {
    authForms.style.display = 'none';
    authLogged.style.display = 'flex';
    if (content) content.style.display = 'block';
    if (authGate) authGate.style.display = 'none';
    coachingSwitchTab('ch-dashboard');
  } else {
    authForms.style.display = 'block';
    authLogged.style.display = 'none';
    if (content) content.style.display = 'none';
    if (authGate) authGate.style.display = 'block';
  }
}

async function coachingLogin() {
  const email = document.getElementById('ch-login-email').value;
  const pw = document.getElementById('ch-login-password').value;
  const err = document.getElementById('ch-login-error');
  if (!email || !pw) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
    coachingToken = data.token;
    localStorage.setItem('ch_token', data.token);
    coachingUser = data.user;
    coachingUserRole = data.user.role;
    document.getElementById('ch-user-info').textContent = data.user.email + (data.user.role === 'admin' ? ' (Coach)' : ' (Eleve)');
    coachingUpdateAuthUI();
    err.style.display = 'none';
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

async function coachingRegister() {
  const email = document.getElementById('ch-reg-email').value;
  const pw = document.getElementById('ch-reg-password').value;
  const pw2 = document.getElementById('ch-reg-password2').value;
  const username = document.getElementById('ch-reg-username').value;
  const err = document.getElementById('ch-reg-error');
  if (!email || !pw || !username) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  if (pw !== pw2) { err.textContent = 'Mots de passe differents'; err.style.display = 'block'; return; }
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw, username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur d'inscription");
    coachingToken = data.token;
    localStorage.setItem('ch_token', data.token);
    coachingUser = data.user;
    coachingUserRole = data.user.role;
    document.getElementById('ch-user-info').textContent = data.user.email + (data.user.role === 'admin' ? ' (Coach)' : ' (Eleve)');
    coachingUpdateAuthUI();
    err.style.display = 'none';
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

function coachingLogout() {
  coachingToken = null;
  coachingUser = null;
  coachingUserRole = null;
  localStorage.removeItem('ch_token');
  document.getElementById('ch-login-form').style.display = 'block';
  document.getElementById('ch-register-form').style.display = 'none';
  coachingUpdateAuthUI();
}

function coachingToggleAuth(mode) {
  document.getElementById('ch-login-form').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('ch-register-form').style.display = mode === 'register' ? 'block' : 'none';
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
}

// ============ DASHBOARD ============

function coachingRenderDashboard() {
  const sessions = getSessionCount();
  const completed = getCompletedScenarios().length;
  const watched = getWatchedVods().length;
  const acc = localStorage.getItem('visc_settings') ? '—' : '0%';

  document.getElementById('ch-dash-sessions').textContent = sessions;
  document.getElementById('ch-dash-scenarios').textContent = completed;
  document.getElementById('ch-dash-accuracy').textContent = acc;
  document.getElementById('ch-dash-vods').textContent = watched;
}

// ============ RENDER SCENARIOS ============

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

  if (!filtered.length) {
    list.innerHTML = '<p class="ch-empty">Aucun scenario trouve.</p>';
    return;
  }

  const completed = getCompletedScenarios();

  filtered.forEach(s => {
    const stars = '\u2605'.repeat(s.difficulty || 3);
    const done = completed.includes(s.id);
    const card = document.createElement('div');
    card.className = 'ch-card' + (done ? ' ch-done' : '');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="ch-badge">${s.rank}</span>
        ${done ? '<span class="ch-badge-done">Complete</span>' : ''}
      </div>
      <div class="ch-card-title">${s.title}</div>
      <div class="ch-card-meta">${s.map} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'defense' ? 'Defense' : 'Retake'}</div>
      <div class="ch-stars">${stars}</div>
      <p class="ch-card-desc">${s.description}</p>
      <button class="btn-primary ch-card-btn" data-scenario-id="${s.id}">Voir le guide</button>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => coachingOpenScenarioModal(s));
    list.appendChild(card);
  });
}

function coachingOpenScenarioModal(scenario) {
  const modal = document.getElementById('ch-scenario-modal');
  if (!modal) return;
  const completed = getCompletedScenarios().includes(scenario.id);

  document.getElementById('ch-sm-title').textContent = scenario.title;
  document.getElementById('ch-sm-badge').textContent = scenario.rank;
  document.getElementById('ch-sm-meta').textContent = `${scenario.map} \u00b7 ${scenario.type === 'attack' ? 'Attaque' : scenario.type === 'defense' ? 'Defense' : 'Retake'} \u00b7 Difficulte ${scenario.difficulty}/5`;
  document.getElementById('ch-sm-guide').textContent = scenario.guide || 'Guide non disponible.';
  document.getElementById('ch-sm-tips').textContent = scenario.tips || '';

  const trainBtn = document.getElementById('ch-sm-train-btn');
  trainBtn.textContent = scenario.aimMode ? `S'entrainer (${scenario.aimMode.replace('_',' ')})` : "S'entrainer";
  trainBtn.onclick = () => {
    coachingCloseScenarioModal();
    markScenarioCompleted(scenario.id);
    incrementSessions();
    document.getElementById('coaching-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
    // Set difficulty and start game mode
    if (scenario.aimDiff) document.getElementById('opt-diff').value = scenario.aimDiff;
    setTimeout(() => {
      const modeBtn = document.querySelector(`.mode-card[data-mode="${scenario.aimMode}"]`);
      if (modeBtn) modeBtn.click();
    }, 100);
  };

  const completeBtn = document.getElementById('ch-sm-complete-btn');
  completeBtn.textContent = completed ? 'Deja complete' : 'Marquer comme complete';
  completeBtn.disabled = completed;
  completeBtn.onclick = () => {
    markScenarioCompleted(scenario.id);
    completeBtn.textContent = 'Deja complete';
    completeBtn.disabled = true;
  };

  modal.classList.add('active');
}

function coachingCloseScenarioModal() {
  const modal = document.getElementById('ch-scenario-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ============ RENDER AGENTS ============

function coachingRenderAgents() {
  const role = document.getElementById('ch-agent-role-filter')?.value || '';
  const search = (document.getElementById('ch-agent-search')?.value || '').toLowerCase();

  let filtered = agentsGuide;
  if (role) filtered = filtered.filter(a => a.role === role);
  if (search) filtered = filtered.filter(a => a.name.toLowerCase().includes(search));

  const list = document.getElementById('ch-agents-list');
  if (!list) return;
  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = '<p class="ch-empty">Aucun agent trouve.</p>';
    return;
  }

  filtered.forEach(a => {
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = `
      <div class="ch-card-title">${a.name}</div>
      <span class="ch-badge">${a.role}</span>
      <p class="ch-card-desc" style="font-style:italic;margin-top:10px">${a.summary}</p>
      <div class="ch-howto">
        <strong>Comment jouer :</strong><br>${a.howToPlay}
      </div>
    `;
    list.appendChild(card);
  });
}

// ============ RENDER VODS ============

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

  if (!filtered.length) {
    list.innerHTML = '<p class="ch-empty">Aucune VOD trouvee.</p>';
    return;
  }

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
      // Re-render to show "Vu" badge
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
  if (modal) {
    modal.classList.remove('active');
    document.getElementById('ch-vm-iframe').src = '';
  }
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', initCoaching);
