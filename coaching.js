// ============ COACHING HUB + GLOBAL AUTH ============

const API_BASE = '/api';

// XSS sanitization — wrap all user data before inserting in innerHTML
function san(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// Rank badge HTML
const VALORANT_RANK_COLORS = {
  Iron:'#8B9093', Bronze:'#A0694A', Silver:'#B0B5BB', Gold:'#E4B549',
  Platinum:'#3DBAB0', Diamond:'#4D9BE6', Ascendant:'#40B270',
  Immortal:'#E0495A', Radiant:'#F4D35E'
};
function rankBadge(rank) {
  if (!rank) return '';
  const tier = rank.split(' ')[0];
  const c = VALORANT_RANK_COLORS[tier] || '#888';
  return `<span class="rank-badge" style="background:${c}22;color:${c};border:1px solid ${c}66">${san(rank)}</span>`;
}

let coachingUser = null;
let coachingUserRole = null;
let coachingToken = null;

(function restoreSession() {
  const saved = localStorage.getItem('ch_token');
  if (saved) coachingToken = saved;
})();

// ============ LOCAL STORAGE TRACKING ============

function getSessionCount() { return parseInt(localStorage.getItem('ch_sessions') || '0'); }
function incrementSessions() { localStorage.setItem('ch_sessions', String(getSessionCount() + 1)); }

// ============ DATA: AGENTS ============

// Load custom agent edits from localStorage
function getCustomAgents() {
  try { return JSON.parse(localStorage.getItem('ch_custom_agents') || '{}'); } catch { return {}; }
}
function saveCustomAgent(name, data) {
  const all = getCustomAgents();
  all[name] = data;
  localStorage.setItem('ch_custom_agents', JSON.stringify(all));
  pushAgentEditToDB(name, data);
}
function deleteCustomAgent(name) {
  const all = getCustomAgents();
  delete all[name];
  localStorage.setItem('ch_custom_agents', JSON.stringify(all));
}
function getAgent(a) {
  const custom = getCustomAgents()[a.name];
  return custom ? { ...a, ...custom } : a;
}

const agentsGuide = [
  { name: 'Brimstone', role: 'Controller', summary: "Controleur fiable avec 3 smokes longue duree et un ulti devastateur. Ideal pour organiser des executes coordonnées et dominer le post-plant grace a ses mollys.", howToPlay: "En attaque : place tes 3 smokes sur les crossfires clés du site vise, puis entre avec ton équipe. En défense : garde 1-2 smokes pour les retakes. Ton ulti + molly = combo imbattable pour deny le defuse. Joue toujours en soutien, jamais en first." },
  { name: 'Omen', role: 'Controller', summary: "Controleur versatile qui excelle dans la deception. Ses smokes se rechargent, son TP permet des repositionnements imprevus, et son ulti cree une pression globale.", howToPlay: "Place tes smokes en profondeur pour isoler les duels (one-way si possible). Utilise tes TP pour changer d'angle apres chaque kill. En mid-round, flanke avec ton TP pour backstab. Ton ulti est parfait pour info ou retakes surprise." },
  { name: 'Viper', role: 'Controller', summary: "Specialiste du controle toxique avec un mur et un orbe qui drainent la vie. Imbattable en post-plant et sur les maps avec de longues lignes de vue.", howToPlay: "Apprends 2-3 line-ups de mur et de molly par map. Garde ton fuel pour les moments critiques. En post-plant : molly le spike + mur pour couper les angles. Son ulti transforme un site entier en forteresse." },
  { name: 'Astra', role: 'Controller', summary: "Controleur stratégique a l'echelle globale. Place ses etoiles pour créer smokes, stuns, et aspirations n'importe ou sur la map.", howToPlay: "Avant le round : place tes etoiles sur les choke points. Pull pour stopper les rushes, stun pour ouvrir les sites. Communique en permanence - Astra est inutile sans coordination." },
  { name: 'Harbor', role: 'Controller', summary: "Controleur dynamique dont le mur d'eau mobile accompagne les pushes.", howToPlay: "Lance ton mur pour accompagner le rush. Les cascades ralentissent les rotations. L'ulti est devastateur sur les sites fermes." },
  { name: 'Clove', role: 'Controller', summary: "Controleur agressif unique qui peut poser des smokes même apres sa mort.", howToPlay: "Joue plus agressif qu'un controleur classique. Si tu meurs pendant une execute, pose immédiatement tes smokes depuis la mort pour finir le round." },
  { name: 'Jett', role: 'Duelist', summary: "Entry fragger aerienne avec une mobilite sans egale. Son dash permet des peeks agressifs sans risque.", howToPlay: "prépare TOUJOURS ton dash avant un peek agressif. Entre en premier avec l'util de tes mates. Apres un kill, dash pour eviter le trade." },
  { name: 'Reyna', role: 'Duelist', summary: "Duelist purement orientee combat 1v1 qui snowball sur ses kills.", howToPlay: "Ne prends JAMAIS un duel sans orbe disponible. Apres chaque kill : dismiss pour sortir ou heal pour rester agressif." },
  { name: 'Raze', role: 'Duelist', summary: "Duelist explosive specialisee dans le nettoyage de zone. Ses satchels offrent une mobilite aerienne unique.", howToPlay: "Ouvre chaque round avec ta nade sur les positions standards. Double satchel pour entrer par les airs. Ton ulti doit garantir un kill decisif." },
  { name: 'Phoenix', role: 'Duelist', summary: "Duelist auto-suffisant avec flashs, mur de feu et molly de soin.", howToPlay: "Ta flash courbe est parfaite pour les peeks solo. Utilise mur + molly pour te soigner. Ton ulti est un entry parfait sans risque." },
  { name: 'Yoru', role: 'Duelist', summary: "Duelist furtif specialise dans les flanks, fakes et timings inattendus.", howToPlay: "Pre-place ton TP dans une position safe. Combine faux pas + TP pour fakes. En ulti : prends l'info deep puis backstab." },
  { name: 'Neon', role: 'Duelist', summary: "Duelist a haute velocite qui casse tous les timings.", howToPlay: "Utilise ton mur pour créer un couloir d'entrée safe, puis slide pour prendre le site. Ne cours jamais en ligne droite." },
  { name: 'Iso', role: 'Duelist', summary: "Duelist methodique qui excelle dans les duels isoles. Son bouclier absorbe un tir mortel.", howToPlay: "Active ton bouclier avant chaque peek. L'ulti cible les joueurs problematiques : l'oppeur, l'anchor, ou le clutcher." },
  { name: 'Miks', role: 'Duelist', summary: "Duelist tactique avec des capacites de disruption sonore.", howToPlay: "Utilise tes capacites sonores pour deorienter les défenseurs avant d'entrer. Combine tes disruptions avec les flashs de tes initiators." },
  { name: 'Sova', role: 'Initiator', summary: "Initiator d'info supreme avec drone et fleche de recon.", howToPlay: "Apprends 3-5 line-ups de fleche par map. Drone AVANT que tes duelists entrent. Garde les shock darts pour le post-plant." },
  { name: 'Skye', role: 'Initiator', summary: "Initiator hybride avec flash guidee, chien eclaireur et heal d'équipe.", howToPlay: "Pop-flash TOUJOURS pour tes duelists. Ton chien clear les zones dangereuses. Le heal est precieux : priorise les joueurs a bas HP." },
  { name: 'Fade', role: 'Initiator', summary: "Initiator qui traque et paralyse les ennemis.", howToPlay: "Lance ta haunt au debut de chaque execute. Les snares sur les choke points punissent les pushes. L'ulti est parfait pour les retakes." },
  { name: 'KAY/O', role: 'Initiator', summary: "Initiator anti-capacites qui neutralise l'util ennemi dans une zone.", howToPlay: "Lance ton knife de suppression AVANT l'execute. Tes flashs sont rapides - right-click pour pop-flash. En ulti, entre en premier car tu peux te faire revive." },
  { name: 'Breach', role: 'Initiator', summary: "Initiator de breche qui traverse les murs avec stuns, flashs et tremblements.", howToPlay: "coordonné TOUJOURS tes stuns avec l'entry de ton duelist. L'ulti est devastateur sur les petits sites." },
  { name: 'Gekko', role: 'Initiator', summary: "Initiator polyvalent avec des creatures recuperables. Le meilleur pick pour solo-queue.", howToPlay: "Mosh pit sur les coins standards. Wingman peut planter ou defuser pendant que tu couvres. Recupere TOUJOURS tes creatures." },
  { name: 'Sage', role: 'Sentinel', summary: "Sentinel de soutien avec mur, slows et resurrection.", howToPlay: "Le mur peut bloquer les rushs OU créer des angles eleves. Ton rez doit changer le round : priorise l'oppeur, l'anchor ou l'entry." },
  { name: 'Killjoy', role: 'Sentinel', summary: "Sentinel de zone avec tourelle, alarmbots et nanoswarms.", howToPlay: "Setup ta tourelle + alarmbot pour couvrir l'entrée principale. Les nanoswarms sous le spike = deny defuse garanti." },
  { name: 'Cypher', role: 'Sentinel', summary: "Sentinel d'information avec camera, trips et cage.", howToPlay: "Camera + trips sur les points d'entrée clés. Donne l'info DES que tu détectés quelque chose. Change tes placements chaque round." },
  { name: 'Chamber', role: 'Sentinel', summary: "Sentinel orientee duel avec TP défensif et armes de precision.", howToPlay: "Place ton TP avant de prendre une ligne agressive. Apres un kill, TP immédiatEMENT pour eviter le trade." },
];

// ============ DATA: scenarios (default, will be overridden by DB) ============

const DEFAULT_SCENARIOS = [

  // ════════════════════════════════════════
  // BIND
  // ════════════════════════════════════════
  {
    id: 1, title: "B Execute via Hookah — Bind", rank: "SILVER", map: "Bind", type: "attack", difficulty: 2,
    description: "Exécution classique sur B site en passant par hookah. Le controller smoke CT et le duelist entre le premier.",
    guide: "1. Le controller smoke l'angle CT (sortie hookah) et le coin U-Hall\n2. L'initiator lance une flash par-dessus hookah pour aveugler les défenseurs\n3. Le duelist entre hookah en pre-aim CT dès la sortie\n4. Un second joueur suit et clear le coin gauche (derrière la caisse)\n5. Un troisième joueur entre par B main pour couper les rotations\n6. Plant derrière la grande boîte — difficile à défuser depuis CT",
    tips: "Ne jamais entrer hookah sans smoke CT — c'est un angle à mort garantie. En sortant, pre-aim immédiatement CT avant toute chose. La boîte centrale B est le meilleur spot de plant : elle donne couverture depuis toutes les entrées.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  // ════════════════════════════════════════
  // BIND
  // ════════════════════════════════════════
  {
    id: 2, title: "Défense A Short — Bind", rank: "SILVER", map: "Bind", type: "defense", difficulty: 2,
    description: "Tenir A site depuis les positions Short et CT. Objectif : forcer les attaquants à utiliser leurs utils avant d'entrer.",
    guide: "1. 1 joueur tient A short depuis le coin CT (angle sur l'entrée)\n2. 1 joueur hold elbow avec angle sur A main\n3. Sentinel place un trip au pied de short A pour détecter les pushes\n4. Controller garde une smoke pour urgence (smoke A main si rush)\n5. Si les attaquants entrent : ne pas peeker, attendre le crossfire short + elbow\n6. En retake : entrer par CT et showers TP simultanément",
    tips: "Ne jamais quitter le coin CT sans info — c'est la position la plus forte. Si tu entends des pas sur les toits de showers, informe ton équipe immédiatement. Le crossfire short + elbow rend l'entrée A très difficile sans smoke.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 3, title: "Retake B via Showers TP — Bind", rank: "GOLD", map: "Bind", type: "retake", difficulty: 3,
    description: "Reprendre B site en coordonnant une entrée par B main et une sortie du téléporteur showers.",
    guide: "1. 1-2 joueurs avancent par B main (côté long B)\n2. 1 joueur utilise le TP showers pour arriver côté garden B\n3. Flash le site depuis B main avant d'entrer\n4. Smoke U-Hall pour couper les renforts depuis hookah\n5. Pincer : un depuis B main, un depuis garden simultanément\n6. Ne defuser qu'une fois le site entièrement clear",
    tips: "Le TP showers est l'atout principal du retake B — arriver de deux côtés désorganise totalement les défenseurs. Écoute le spike pour localiser les ennemis. Ne jamais defuser seul si tu n'as pas confirmé les positions.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // HAVEN
  // ════════════════════════════════════════
  {
    id: 4, title: "Execute C coordonné — Haven", rank: "SILVER", map: "Haven", type: "attack", difficulty: 2,
    description: "Exécuter sur C site avec smoke CT et flash pour neutraliser le défenseur CT avant d'entrer.",
    guide: "1. Controller smoke CT C (l'angle dominant en sortant de C main)\n2. Controller smoke le coin C right si un défenseur y est habituel\n3. Initiator flash depuis C lobby au-dessus du mur\n4. Duelist entre le premier (pre-aim CT en sortant)\n5. Deuxième joueur clear le coin droit immédiatement\n6. Plant derrière la boîte centrale ou au fond selon le clear",
    tips: "CT est le seul angle vraiment dangereux sur C — une seule smoke suffit. Entre vite et plante rapidement, les rotations depuis A sont rapides sur Haven. Le coin C right est souvent oublié : check-le systématiquement.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 5, title: "Contrôle Mid Garage + Window — Haven", rank: "GOLD", map: "Haven", type: "defense", difficulty: 3,
    description: "Dominer le mid de Haven depuis garage et window pour bloquer les rotations et collecter l'info.",
    guide: "1. 1 joueur hold mid depuis le coin garage (vue sur window)\n2. 1 joueur hold window depuis mid (crossfire avec garage)\n3. Sentinel place un trip sur la porte B mid pour l'info\n4. Controller garde 1 smoke pour urgence mid\n5. Si push mid : smoke B door + crossfire garage + window simultanément\n6. Ne jamais rotater sans call — les rotations inutiles perdent des rounds",
    tips: "Celui qui contrôle mid sur Haven contrôle les rotations. Le crossfire garage + window est très difficile à traverser sans utils. Garde toujours une smoke pour l'urgence — ne la gaspille pas en début de round.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 6, title: "Retake A via Long + Short — Haven", rank: "GOLD", map: "Haven", type: "retake", difficulty: 3,
    description: "Reprendre A site en entrant par long A et short A simultanément pour pincer les défenseurs.",
    guide: "1. 1 joueur avance par long A (depuis CT)\n2. 1 joueur descend short A (depuis CT short)\n3. Initiator flash le site depuis l'entrée long A\n4. Smoke le coin CT box si un défenseur y est probable\n5. Pincer : un depuis long, un depuis short en même temps\n6. Defuser en couvrant long A et short simultanément",
    tips: "Long A est l'angle de post-plant le plus utilisé sur A Haven — priorité absolue. Si tu entres seul, utilise une flash + jiggle peek pour forcer un tir avant d'entrer. La coordination timing entre les deux joueurs est la clé.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // SPLIT
  // ════════════════════════════════════════
  {
    id: 7, title: "Execute B Heaven + Main — Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2,
    description: "Prendre B site en combinant une entrée par B heaven (depuis mid) et B main simultanément.",
    guide: "1. Controller smoke B heaven pour monter depuis mid en sécurité\n2. Controller smoke B window pour bloquer la vue depuis mid\n3. Initiator flash B main pour l'entry\n4. Joueur 1 monte heaven depuis mid (couvre tout le site depuis le haut)\n5. Joueurs 2-3 entrent B main simultanément\n6. Plant derrière le container central — difficile à défuser depuis heaven",
    tips: "Heaven donne une vue sur tout B site — le joueur là-haut doit caller chaque position. La smoke heaven pour monter est non-négociable. Back-B est l'angle le plus souvent oublié par les attaquants : check-le immédiatement.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 8, title: "Hold A CT Ropes + Main — Split", rank: "GOLD", map: "Split", type: "defense", difficulty: 3,
    description: "Défendre A site depuis CT avec un crossfire naturel entre la position ropes et A main.",
    guide: "1. 1 joueur tient ropes depuis CT (angle élevé sur l'entrée)\n2. 1 joueur hold A main depuis le coin CT\n3. Sentinel setup un trip sur A heaven pour détecter les flanks\n4. Controller garde une smoke pour ropes si besoin\n5. Ne jamais peeker sans info — attendre le push et crossfire\n6. Si perdus : reculer mid et attendre le retake",
    tips: "Le crossfire ropes + main rend l'entrée A quasiment impossible sans utils. La position ropes est dominante mais exposée aux flashs — recule si flash détectée. Heaven est le flank le plus dangereux : le sentinel doit obligatoirement le couvrir.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 9, title: "Retake B depuis CT + Mid Window — Split", rank: "GOLD", map: "Split", type: "retake", difficulty: 3,
    description: "Reprendre B site en entrant par CT et par mid window simultanément pour pincer les défenseurs.",
    guide: "1. 1 joueur entre B depuis CT direct\n2. 1 joueur passe par mid et descend window\n3. Flash le site depuis CT avant d'entrer\n4. Smoke le coin back-B si un défenseur y est probable\n5. Pincer : un depuis CT, un depuis window simultanément\n6. Defuser derrière le container — couverture depuis les deux angles",
    tips: "Back-B est le spot de post-plant préféré sur B Split — toujours le checker ou le smoker. Window donne un angle surprenant sur tout le site. Ne defuser jamais si back-B n'est pas confirmé clear.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // LOTUS
  // ════════════════════════════════════════
  {
    id: 10, title: "Execute A avec cassage de porte — Lotus", rank: "GOLD", map: "Lotus", type: "attack", difficulty: 3,
    description: "Exécuter sur A site en cassant la porte pour créer un angle supplémentaire et smoker tree + root.",
    guide: "1. Un joueur casse la porte A (le bruit peut masquer l'exécution)\n2. Controller smoke tree ET root simultanément\n3. Initiator flash depuis A main en direction du site\n4. Duelist entre le premier — pre-aim tree immédiatement\n5. Deuxième joueur clear root corner\n6. Plant derrière le stone ou spot default selon le clear",
    tips: "Tree est l'angle le plus mortel de A Lotus — il doit TOUJOURS être smoké en premier. Root est souvent tenu agressivement : approche avec une flash. Casser la porte crée du bruit — utilise ça stratégiquement pour masquer ton timing d'entrée.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 11, title: "Hold C depuis Mound — Lotus", rank: "GOLD", map: "Lotus", type: "defense", difficulty: 3,
    description: "Défendre C site depuis la position mound avec un angle dominant sur toute l'entrée principale.",
    guide: "1. 1 joueur prend mound (position haute, vue sur toute l'entrée C)\n2. 1 joueur hold le coin C link depuis le site\n3. Sentinel place un trip à l'entrée C main pour l'info\n4. Controller garde une smoke pour l'urgence (smoke C main si rush)\n5. Si push : le joueur mound engage le premier — le second flanke depuis link\n6. Ne jamais rester sur mound après avoir tiré — repositionne-toi",
    tips: "Mound est la position dominante de C Lotus mais très exposée aux grenades. Repositionne-toi après chaque engagement. Le trip sentinel à l'entrée est l'info la plus précieuse — ne jamais s'en priver.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 12, title: "Retake B via A Link + B Main — Lotus", rank: "GOLD", map: "Lotus", type: "retake", difficulty: 3,
    description: "Reprendre B site en coordonnant une entrée par B main et une par A link pour pincer.",
    guide: "1. 1 joueur entre B depuis B main (chemin direct)\n2. 1 joueur passe par A link pour arriver côté link B\n3. Flash le site depuis B main avant d'entrer\n4. Smoke le coin C connection pour bloquer les renforts\n5. Pincer : un depuis B main, un depuis link en même temps\n6. Defuser derrière le rocher central",
    tips: "Le rocher central B est le meilleur spot de défense post-plant sur Lotus. A link donne un angle de retake complètement inattendu — profite-en. Ne defuser jamais sans avoir confirmé les deux angles principaux.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // BREEZE
  // ════════════════════════════════════════
  {
    id: 13, title: "Execute B via Tunnel — Breeze", rank: "SILVER", map: "Breeze", type: "attack", difficulty: 2,
    description: "Exécuter sur B site en passant par le tunnel avec smoke CT et flash pour sécuriser l'entrée.",
    guide: "1. Controller smoke CT B (l'angle dominant en sortant du tunnel)\n2. Initiator flash dans le tunnel avant d'entrer\n3. Duelist entre le premier — pre-aim CT dès la sortie\n4. Deuxième joueur clear le coin Arco (à droite en sortant)\n5. Troisième joueur entre et couvre l'angle mid B\n6. Plant au centre du site ou derrière la caisse selon le clear",
    tips: "CT est l'angle le plus dangereux en sortie de tunnel — une smoke suffit mais elle est obligatoire. Arco est souvent oublié mais fréquemment tenu : check-le systématiquement. Ne t'entasse pas dans le tunnel — entre un par un rapidement.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 14, title: "Hold A avec mur Viper — Breeze", rank: "PLATINUM", map: "Breeze", type: "defense", difficulty: 4,
    description: "Tenir A site avec le mur de Viper pour créer un one-way et forcer les attaquants à se découvrir.",
    guide: "1. Viper place son mur en diagonale sur A main (créé un one-way)\n2. 1 joueur se positionne derrière le mur (one-way advantage)\n3. 1 joueur tient le pilier avec angle sur A site\n4. Viper place son orbe près de CT pour le post-plant\n5. Si execute : ulti Viper sur le spike pour deny le défuse\n6. Communiquer les traversées via le mur (= alert automatique)",
    tips: "Le mur Viper sur A Breeze est un des setups défensifs les plus forts du jeu — apprends le placement exact. Le one-way donne un avantage informationnel majeur. Si les attaquants ont Brimstone ou Astra pour re-smoker, prépare un plan B.",
    aim_mode: "pasu_reload", aim_diff: "hard"
  },
  {
    id: 15, title: "Retake A via Cave + Main — Breeze", rank: "GOLD", map: "Breeze", type: "retake", difficulty: 3,
    description: "Reprendre A site en combinant une entrée par A cave et une par A main pour pincer les défenseurs.",
    guide: "1. 1 joueur entre par A main (depuis CT)\n2. 1 joueur entre par cave (angle latéral inattendu)\n3. Flash le site depuis A main avant d'entrer\n4. Smoke le pilier si un défenseur s'y cache probable\n5. Pincer : un depuis main, un depuis cave simultanément\n6. Defuser derrière le pilier — seul point de couverture sur A",
    tips: "Cave est l'angle de retake le plus rapide et le plus inattendu sur A Breeze. Le pilier est la seule couverture sur le site — priorité absolue pour le défuse. Ne jamais defuser sans avoir confirmé pilier ET cave.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // FRACTURE
  // ════════════════════════════════════════
  {
    id: 16, title: "Execute B depuis Attacker Side — Fracture", rank: "SILVER", map: "Fracture", type: "attack", difficulty: 2,
    description: "Exécuter sur B site via arcade avec smoke dish et flash pour sécuriser l'entrée principale.",
    guide: "1. Controller smoke dish (le défenseur dish est très agressif)\n2. Controller smoke CT B pour bloquer les rotations\n3. Initiator flash depuis le couloir arcade\n4. Duelist entre arcade — pre-aim dish corner puis CT\n5. Deuxième joueur clear le coin escaliers en entrant\n6. Plant derrière la grande boîte ou spot default B",
    tips: "Dish est la position la plus agressive de B Fracture — il faut le smoker ou le flasher sans exception. Les rotations depuis CT arrivent vite : plante rapidement dès que le site est clear. Le coin escaliers est souvent oublié mais régulièrement tenu.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 17, title: "Hold A Dish + Main Crossfire — Fracture", rank: "GOLD", map: "Fracture", type: "defense", difficulty: 3,
    description: "Défendre A site avec un crossfire entre dish et A main pour couvrir les deux entrées simultanément.",
    guide: "1. 1 joueur tient dish (vue sur A arcade et entrée)\n2. 1 joueur hold A main depuis le coin CT\n3. Sentinel place un trip sur l'entrée arcade pour l'info\n4. Controller garde une smoke pour urgence (smoke dish si flash)\n5. Si push arcade : dish engage, A main flanke par derrière\n6. Si push A main : A main engage, dish repositionne depuis CT",
    tips: "Dish est la meilleure position offensive de A Fracture mais très exposée aux flashs. Toujours avoir un joueur en soutien pour le trade. La trip sentinel sur arcade est l'info la plus précieuse — ne jamais s'en priver.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 18, title: "Retake B via Arcade + Rope — Fracture", rank: "GOLD", map: "Fracture", type: "retake", difficulty: 3,
    description: "Reprendre B site en entrant par arcade et par la corde simultanément pour pincer les défenseurs.",
    guide: "1. 1 joueur entre B depuis arcade (chemin direct)\n2. 1 joueur passe par la corde pour arriver côté rope B\n3. Flash le site depuis arcade avant d'entrer\n4. Smoke le coin CT B si un défenseur probable\n5. Pincer : un depuis arcade, un depuis rope en même temps\n6. Defuser derrière la grande boîte — couverture sur les deux angles",
    tips: "L'entrée depuis la corde est complètement inattendue sur le retake — maximise cet effet de surprise. CT B est le spot de post-plant le plus utilisé sur Fracture : flash ou smoke avant d'approcher. Ne defuse jamais si rope side n'est pas confirmé.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // PEARL
  // ════════════════════════════════════════
  {
    id: 19, title: "Execute B Main — Pearl", rank: "SILVER", map: "Pearl", type: "attack", difficulty: 2,
    description: "Exécuter sur B site via B main avec smoke CT et flash pour sécuriser l'entrée unique.",
    guide: "1. Controller smoke CT B (l'angle dominant sur toute l'entrée)\n2. Initiator flash B main par-dessus le mur\n3. Duelist entre le premier — pre-aim le coin droit immédiatement\n4. Deuxième joueur check derrière la grande colonne\n5. Troisième joueur entre et couvre B screens\n6. Plant derrière la colonne ou dans le coin — difficile à défuser depuis CT",
    tips: "CT B est le seul angle vraiment dangereux en entrée — une smoke suffit mais elle est obligatoire. Le coin droit en entrant est fréquemment tenu agressivement. La colonne centrale offre la meilleure couverture pour le plant.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 20, title: "Hold A CT + Link Sentinel Setup — Pearl", rank: "GOLD", map: "Pearl", type: "defense", difficulty: 3,
    description: "Défendre A site avec un sentinel setup sur link et un crossfire CT + art pour couvrir les angles.",
    guide: "1. Sentinel (KJ/Cypher) setup un trip sur A link pour l'info\n2. 1 joueur tient CT A (angle dominant sur l'entrée via link)\n3. 1 joueur hold art depuis le site (crossfire avec CT)\n4. Controller garde une smoke pour urgence (smoke link si rush)\n5. Si push link : CT engage, art flanke depuis le site\n6. Ne jamais quitter CT sans call — c'est la position la plus forte",
    tips: "CT est la position la plus forte de A Pearl — ne jamais la quitter sans raison. Art est le second angle préféré des attaquants en post-plant : couvre-le systématiquement. Le trip sur link donne l'info gratuite dès le début du round.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 21, title: "Retake A via CT + Link — Pearl", rank: "GOLD", map: "Pearl", type: "retake", difficulty: 3,
    description: "Reprendre A site en entrant par CT et par link simultanément pour pincer les défenseurs.",
    guide: "1. 1 joueur entre A depuis CT direct\n2. 1 joueur passe par link pour arriver sur le flanc\n3. Flash le site depuis CT avant d'entrer\n4. Smoke art si un défenseur probable dans ce coin\n5. Pincer : un depuis CT, un depuis link simultanément\n6. Defuser derrière la structure centrale — couverture sur CT et art",
    tips: "CT est l'angle de post-plant le plus populaire sur A Pearl — flash avant d'y approcher. Art est le second spot préféré : smoke ou flash si tu n'as pas l'info. La structure centrale offre la meilleure protection pour le défuse.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // BIND (additional)
  // ════════════════════════════════════════
  {
    id: 22, title: "Défense B Site Hookah Control — Bind", rank: "GOLD", map: "Bind", type: "defense", difficulty: 3,
    description: "Tenir B site en contrôlant hookah et les angles depuis CT pour empêcher toute exécution.",
    guide: "1. Sentinel place un trip à l'entrée de hookah pour l'info précoce\n2. 1 joueur tient l'angle CT B avec vue sur hookah sortie\n3. 1 joueur hold le coin U-Hall pour couvrir le flanc\n4. Controller garde une smoke pour B main si rush détecté\n5. Si push hookah : le joueur CT engage immédiatement, U-Hall flanke\n6. Ne jamais avancer dans hookah seul — c'est un piège mortel",
    tips: "Le trip hookah est l'info la plus précieuse en défense B Bind — ne jamais l'oublier. CT est la position dominante : tu contrôles toute la sortie hookah depuis là. Si tu entends du bruit B main, appelle la rotation mais ne quitte pas CT.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // HAVEN (additional)
  // ════════════════════════════════════════
  {
    id: 23, title: "Hold A depuis Heaven + Short — Haven", rank: "SILVER", map: "Haven", type: "defense", difficulty: 2,
    description: "Défendre A site avec un setup défensif depuis heaven et short pour couvrir toutes les entrées.",
    guide: "1. 1 joueur prend heaven A (vue dominante sur tout le site)\n2. 1 joueur hold short A depuis le coin mur\n3. Sentinel place un trip sur A long pour détecter les pushes\n4. Controller garde une smoke pour A main si rush\n5. Si push A main : heaven engage en premier, short flanke\n6. Si push A long : short engage, heaven couvre depuis le haut",
    tips: "Heaven donne un avantage de hauteur décisif sur A Haven — priorise cette position. Short A est le second angle clé : un joueur doit toujours le tenir. Le trip sur A long donne l'info gratuite dès les premières secondes du round.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // SPLIT (additional)
  // ════════════════════════════════════════
  {
    id: 24, title: "Retake A via CT + Heaven — Split", rank: "PLATINUM", map: "Split", type: "retake", difficulty: 4,
    description: "Reprendre A site en coordonnant une entrée par CT et une montée par heaven pour pincer les post-plant.",
    guide: "1. 1 joueur entre A depuis CT direct (chemin principal)\n2. 1 joueur monte heaven depuis mid pour angle élevé\n3. Initiator flash le site depuis CT avant l'entrée\n4. Smoke le coin ramp si un défenseur probable\n5. Le joueur heaven clear les coins hauts pendant que CT entre\n6. Defuser depuis la position couverte par ramp — heaven surveille",
    tips: "Heaven donne un angle de retake dévastateur — impossible à ignorer pour les post-plant. CT est le chemin direct mais prévisible : flash obligatoire avant d'entrer. La coordination entre CT et heaven doit être simultanée pour maximiser la pince.",
    aim_mode: "vox_ts2", aim_diff: "hard"
  },

  // ════════════════════════════════════════
  // LOTUS (additional)
  // ════════════════════════════════════════
  {
    id: 25, title: "Retake A via Tree + Door — Lotus", rank: "PLATINUM", map: "Lotus", type: "retake", difficulty: 4,
    description: "Reprendre A site en utilisant la porte cassée et l'angle tree pour pincer les attaquants post-plant.",
    guide: "1. 1 joueur entre A depuis le côté tree (CT)\n2. 1 joueur passe par la porte cassée pour un angle latéral\n3. Initiator flash le site depuis tree side avant d'entrer\n4. Smoke root corner si un défenseur y est probable\n5. Pincer : un depuis tree side, un depuis la porte simultanément\n6. Defuser derrière le stone — meilleure couverture sur le site",
    tips: "La porte cassée offre un angle de retake inattendu que beaucoup d'attaquants oublient de couvrir. Tree side reste l'angle dominant — flash avant d'approcher. Ne defuse jamais sans avoir confirmé root ET tree clear.",
    aim_mode: "w1w3ts_reload", aim_diff: "hard"
  },

  // ════════════════════════════════════════
  // BREEZE (additional)
  // ════════════════════════════════════════
  {
    id: 26, title: "Execute A via Mid Door — Breeze", rank: "GOLD", map: "Breeze", type: "attack", difficulty: 3,
    description: "Exécuter sur A site en passant par mid door avec smoke pyramide et flash pour sécuriser l'entrée.",
    guide: "1. Controller smoke pyramide (l'angle dominant depuis A site)\n2. Controller smoke le coin CT A pour bloquer les rotations\n3. Initiator flash mid door avant l'entrée\n4. Duelist entre le premier — pre-aim pyramide immédiatement\n5. Deuxième joueur clear le coin cave à droite\n6. Plant derrière le pilier central — couverture maximale",
    tips: "Pyramide est l'angle le plus mortel de A Breeze depuis mid door — smoke obligatoire. Cave est souvent tenu agressivement : approche avec une flash prête. Le pilier central est le seul cover fiable pour le plant.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // ASCENT (NEW)
  // ════════════════════════════════════════
  {
    id: 27, title: "Execute A via A Main — Ascent", rank: "SILVER", map: "Ascent", type: "attack", difficulty: 2,
    description: "Exécuter sur A site en passant par A main avec smoke heaven et flash pour sécuriser l'entrée.",
    guide: "1. Controller smoke heaven A (l'angle dominant sur le site)\n2. Controller smoke le coin CT pour bloquer la vue défenseur\n3. Initiator flash A main par-dessus le mur\n4. Duelist entre le premier — pre-aim generator immédiatement\n5. Deuxième joueur clear le coin hell (sous heaven)\n6. Plant derrière generator — meilleure couverture depuis A main",
    tips: "Heaven est l'angle le plus dangereux sur A Ascent — une smoke suffit mais elle est obligatoire. Generator est le meilleur spot de plant : il offre une couverture depuis hell et main. Hell est souvent oublié par les attaquants : check-le systématiquement.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 28, title: "Execute B via B Main — Ascent", rank: "SILVER", map: "Ascent", type: "attack", difficulty: 2,
    description: "Exécuter sur B site en passant par B main avec smoke CT et flash pour ouvrir le site.",
    guide: "1. Controller smoke CT B (l'angle dominant en sortant de B main)\n2. Controller smoke le coin market pour bloquer les renforts\n3. Initiator flash B main avant d'entrer le site\n4. Duelist entre le premier — pre-aim lane immédiatement\n5. Deuxième joueur clear le coin back-site (derrière la boîte)\n6. Plant derrière la boîte centrale — difficile à défuser depuis CT",
    tips: "CT est l'angle le plus dangereux en entrée B Ascent — une smoke est non-négociable. Market est la route de rotation principale : smoke-le pour isoler le site. Lane est souvent tenu agressivement — pre-aim en sortant de B main.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 29, title: "Contrôle Mid Catwalk + Market — Ascent", rank: "GOLD", map: "Ascent", type: "defense", difficulty: 3,
    description: "Dominer le mid d'Ascent depuis catwalk et market pour bloquer les splits et collecter l'info.",
    guide: "1. 1 joueur hold catwalk depuis le coin (vue sur top mid)\n2. 1 joueur tient market door (crossfire avec catwalk)\n3. Sentinel place un trip sur bottom mid pour l'info\n4. Controller garde une smoke pour urgence mid\n5. Si push mid : crossfire catwalk + market simultanément\n6. Ne jamais avancer top mid sans info — c'est un death trap",
    tips: "Celui qui contrôle mid sur Ascent contrôle les splits A et B. Le crossfire catwalk + market est extrêmement dur à traverser sans utils. Le trip bottom mid donne l'alerte précoce — ne jamais s'en priver.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },
  {
    id: 30, title: "Retake A via CT + Hell — Ascent", rank: "GOLD", map: "Ascent", type: "retake", difficulty: 3,
    description: "Reprendre A site en entrant par CT et par hell simultanément pour pincer les post-plant.",
    guide: "1. 1 joueur entre A depuis CT direct\n2. 1 joueur passe par hell pour un angle bas inattendu\n3. Flash le site depuis CT avant d'entrer\n4. Smoke generator si un défenseur probable\n5. Pincer : un depuis CT, un depuis hell en même temps\n6. Defuser derrière generator — couverture sur CT et main",
    tips: "Hell donne un angle de retake bas et inattendu que beaucoup d'attaquants oublient. Generator est le spot de post-plant le plus populaire sur A Ascent — flash ou smoke. La coordination entre CT et hell doit être parfaite pour réussir la pince.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },

  // ════════════════════════════════════════
  // ICEBOX (NEW)
  // ════════════════════════════════════════
  {
    id: 31, title: "Execute A via A Belt — Icebox", rank: "GOLD", map: "Icebox", type: "attack", difficulty: 3,
    description: "Exécuter sur A site en passant par belt avec smoke rafters et flash pour ouvrir le site.",
    guide: "1. Controller smoke rafters (le défenseur là-haut voit tout le site)\n2. Controller smoke le coin CT A pour bloquer les rotations\n3. Initiator flash A main depuis le couloir belt\n4. Duelist entre par belt — pre-aim nest immédiatement\n5. Deuxième joueur clear le coin pipes (à gauche en entrant)\n6. Plant sur le spot default — visible depuis belt pour le post-plant",
    tips: "Rafters est la position la plus forte de A Icebox — impossible d'entrer sans la smoker. Nest est souvent tenu agressivement par un sentinel : flash avant d'approcher. Le plant default permet de surveiller depuis belt en post-plant.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 32, title: "Execute B via B Orange — Icebox", rank: "SILVER", map: "Icebox", type: "attack", difficulty: 2,
    description: "Exécuter sur B site en passant par orange avec smoke CT et flash pour sécuriser l'entrée.",
    guide: "1. Controller smoke CT B (l'angle dominant depuis le fond du site)\n2. Initiator flash orange avant d'entrer\n3. Duelist entre le premier — pre-aim yellow immédiatement\n4. Deuxième joueur clear le coin green (côté gauche)\n5. Troisième joueur couvre kitchen depuis orange\n6. Plant derrière la grande caisse — couverture depuis orange",
    tips: "CT B est l'angle le plus dangereux en entrée — une smoke suffit mais elle est obligatoire. Yellow est souvent tenu agressivement : pre-aim en entrant. Green est fréquemment oublié mais régulièrement occupé par un sentinel.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 33, title: "Hold B Kitchen + Yellow Setup — Icebox", rank: "GOLD", map: "Icebox", type: "defense", difficulty: 3,
    description: "Défendre B site avec un crossfire entre kitchen et yellow pour couvrir toutes les entrées.",
    guide: "1. 1 joueur tient yellow (vue sur orange et entrée B)\n2. 1 joueur hold kitchen (crossfire avec yellow)\n3. Sentinel place un trip sur l'entrée orange pour l'info\n4. Controller garde une smoke pour orange si rush détecté\n5. Si push orange : yellow engage, kitchen flanke\n6. Si push green : kitchen engage, yellow repositionne",
    tips: "Le crossfire yellow + kitchen rend l'entrée B très difficile sans utils. Yellow est exposé aux flashs — recule si une flash est annoncée. Le trip orange est l'info la plus précieuse en défense B Icebox.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },
  {
    id: 34, title: "Retake A via Rafters + Belt — Icebox", rank: "PLATINUM", map: "Icebox", type: "retake", difficulty: 4,
    description: "Reprendre A site en montant par rafters et en entrant par belt pour pincer les attaquants.",
    guide: "1. 1 joueur monte rafters depuis CT (angle élevé dominant)\n2. 1 joueur entre par belt (chemin direct)\n3. Flash le site depuis belt avant d'entrer\n4. Smoke nest si un défenseur y est probable\n5. Pincer : un depuis rafters (haut), un depuis belt (bas)\n6. Defuser derrière le container — couverture depuis rafters",
    tips: "Rafters donne un angle de retake dévastateur impossible à ignorer pour les post-plant. Belt est direct mais prévisible — flash obligatoire. La différence de hauteur entre rafters et belt rend la pince extrêmement difficile à contrer.",
    aim_mode: "vox_ts2", aim_diff: "hard"
  },

  // ════════════════════════════════════════
  // SUNSET (NEW)
  // ════════════════════════════════════════
  {
    id: 35, title: "Execute A via A Main — Sunset", rank: "SILVER", map: "Sunset", type: "attack", difficulty: 2,
    description: "Exécuter sur A site en passant par A main avec smoke elbow et flash pour ouvrir le site.",
    guide: "1. Controller smoke elbow (le défenseur là voit toute l'entrée)\n2. Controller smoke le coin heaven pour bloquer la vue haute\n3. Initiator flash A main avant d'entrer\n4. Duelist entre le premier — pre-aim site center immédiatement\n5. Deuxième joueur clear le coin back-site à droite\n6. Plant derrière la structure centrale — couverture depuis A main",
    tips: "Elbow est l'angle le plus mortel de A Sunset — smoke obligatoire avant d'entrer. Heaven donne un angle élevé dangereux : smoke-le si possible. La structure centrale est le meilleur spot de plant pour le post-plant depuis main.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 36, title: "Hold B depuis Market + CT — Sunset", rank: "GOLD", map: "Sunset", type: "defense", difficulty: 3,
    description: "Défendre B site avec un crossfire depuis market et CT pour couvrir les deux entrées principales.",
    guide: "1. 1 joueur tient market (vue sur B main et entrée)\n2. 1 joueur hold CT B (crossfire avec market)\n3. Sentinel place un trip sur B main pour l'info précoce\n4. Controller garde une smoke pour B main si rush détecté\n5. Si push B main : market engage le premier, CT flanke\n6. Ne jamais avancer dans B main seul — attendre le crossfire",
    tips: "Le crossfire market + CT est la clé de la défense B Sunset. Market est la position agressive — recule après chaque engagement. Le trip B main donne l'info gratuite : ne jamais s'en priver en début de round.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 37, title: "Retake Mid via Courtyard — Sunset", rank: "PLATINUM", map: "Sunset", type: "retake", difficulty: 4,
    description: "Reprendre le contrôle du mid en entrant par courtyard avec des utils pour flush les défenseurs.",
    guide: "1. Initiator lance un drone ou une haunt pour info mid\n2. Controller smoke les angles dominants (top mid)\n3. Flash courtyard avant d'entrer\n4. 1 joueur entre courtyard — clear les coins latéraux\n5. 1 joueur couvre depuis le côté opposé\n6. Une fois mid secure, décider du split A ou B",
    tips: "Le mid de Sunset est crucial pour les rotations — le reprendre change le round. Courtyard est l'entrée la plus sûre pour reprendre mid. Toujours utiliser un drone ou une haunt avant d'entrer — le mid est dangereux sans info.",
    aim_mode: "w1w3ts_reload", aim_diff: "hard"
  },

  // ════════════════════════════════════════
  // ABYSS (NEW)
  // ════════════════════════════════════════
  {
    id: 38, title: "Execute B via B Main — Abyss", rank: "GOLD", map: "Abyss", type: "attack", difficulty: 3,
    description: "Exécuter sur B site en passant par B main avec smoke heaven et flash pour sécuriser l'entrée.",
    guide: "1. Controller smoke heaven B (le défenseur là-haut contrôle tout)\n2. Controller smoke le coin CT B pour bloquer les rotations\n3. Initiator flash B main avant d'entrer\n4. Duelist entre le premier — pre-aim pillar immédiatement\n5. Deuxième joueur clear le coin sous heaven\n6. Plant derrière pillar — couverture maximale depuis B main",
    tips: "Heaven est la position dominante de B Abyss — impossible d'entrer sans la smoker. Attention aux chutes : les bords du site sont mortels sur Abyss. Pillar est le meilleur cover de plant — ne plante jamais à découvert.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 39, title: "Hold A depuis Bridge + CT — Abyss", rank: "SILVER", map: "Abyss", type: "defense", difficulty: 2,
    description: "Défendre A site avec un crossfire entre bridge et CT pour contrôler les entrées.",
    guide: "1. 1 joueur tient bridge (vue sur A main et l'entrée)\n2. 1 joueur hold CT A (crossfire avec bridge)\n3. Sentinel place un trip sur A main pour l'info\n4. Controller garde une smoke pour A main si rush\n5. Si push A main : bridge engage, CT flanke\n6. Attention aux bords — ne jamais reculer trop près du vide",
    tips: "Bridge est la position la plus forte de A Abyss mais attention aux chutes accidentelles. Le crossfire bridge + CT rend l'entrée A très difficile. Sur Abyss, la conscience spatiale est cruciale — les bords sont mortels.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 40, title: "Retake B via CT + Heaven — Abyss", rank: "PLATINUM", map: "Abyss", type: "retake", difficulty: 4,
    description: "Reprendre B site en entrant par CT et en montant heaven pour pincer les post-plant.",
    guide: "1. 1 joueur entre B depuis CT direct\n2. 1 joueur monte heaven B pour l'angle élevé\n3. Flash le site depuis CT avant d'entrer\n4. Smoke pillar si un défenseur probable\n5. Pincer : un depuis CT, un depuis heaven simultanément\n6. Defuser derrière pillar — heaven surveille tout le site",
    tips: "Heaven donne un angle de retake décisif sur B Abyss — priorise cette montée. CT est prévisible mais nécessaire — flash obligatoire. Attention aux knockbacks près des bords du site pendant le retake.",
    aim_mode: "w1w3ts_reload", aim_diff: "hard"
  },
];

// Load scenarios: merge defaults with user-created ones from localStorage
const SCENARIOS_VERSION = 6; // bump when DEFAULT_SCENARIOS changes to clear stale cache
let coachingScenarios = loadScenarios();

function loadScenarios() {
  try {
    // Clear stale cache if version mismatch
    if (parseInt(localStorage.getItem('ch_SCENARIOS_VERSION') || '0') < SCENARIOS_VERSION) {
      localStorage.removeItem('ch_custom_scenarios');
      localStorage.setItem('ch_SCENARIOS_VERSION', String(SCENARIOS_VERSION));
      return JSON.parse(JSON.stringify(DEFAULT_SCENARIOS));
    }
    const saved = JSON.parse(localStorage.getItem('ch_custom_scenarios') || '[]');
    const merged = JSON.parse(JSON.stringify(DEFAULT_SCENARIOS));
    // Only merge truly custom scenarios (ids not in DEFAULT_SCENARIOS)
    const defaultIds = new Set(DEFAULT_SCENARIOS.map(s => s.id));
    saved.forEach(s => {
      if (defaultIds.has(s.id)) return; // skip stale overrides of default scenarios
      merged.push(s);
    });
    return merged;
  } catch { return JSON.parse(JSON.stringify(DEFAULT_SCENARIOS)); }
}

function persistScenarios() {
  const toSave = coachingScenarios.filter(s => {
    const def = DEFAULT_SCENARIOS.find(d => d.id === s.id);
    if (!def) return true;
    return JSON.stringify(def) !== JSON.stringify(s);
  });
  localStorage.setItem('ch_custom_scenarios', JSON.stringify(toSave));
}

// ============ DB SYNC ============

async function fetchScenariosFromDB() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/scenarios`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) return;
    const { scenarios } = await res.json();
    if (!scenarios || !scenarios.length) return;
    const defaultIds = new Set(DEFAULT_SCENARIOS.map(s => s.id));
    const merged = JSON.parse(JSON.stringify(DEFAULT_SCENARIOS));
    scenarios.forEach(s => {
      // Never let DB override DEFAULT_SCENARIOS — only add truly new custom scenarios
      if (!defaultIds.has(s.id)) merged.push(s);
    });
    coachingScenarios = merged;
    persistScenarios();
  } catch (e) { /* fallback to localStorage */ }
}

async function fetchAgentEditsFromDB() {
  try {
    const res = await fetch(`${API_BASE}/coaching?view=coach-data&type=agent`, {
      headers: coachingToken ? { 'Authorization': `Bearer ${coachingToken}` } : {}
    });
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data || !data.length) return;
    const all = getCustomAgents();
    data.forEach(entry => { all[entry.data_key] = entry.data_value; });
    localStorage.setItem('ch_custom_agents', JSON.stringify(all));
  } catch {}
}

async function fetchStratsFromDB() {
  try {
    const res = await fetch(`${API_BASE}/coaching?view=coach-data&type=strat`, {
      headers: coachingToken ? { 'Authorization': `Bearer ${coachingToken}` } : {}
    });
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data || !data.length) return;
    const all = JSON.parse(localStorage.getItem('me_scenario_maps') || '{}');
    data.forEach(entry => { all[entry.data_key] = entry.data_value; });
    localStorage.setItem('me_scenario_maps', JSON.stringify(all));
  } catch {}
}

async function pushAgentEditToDB(name, agentData) {
  if (!coachingToken) return;
  fetch(`${API_BASE}/coaching`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
    body: JSON.stringify({ action: 'coach-data', data_type: 'agent', data_key: name, data_value: agentData })
  }).catch(() => {});
}

async function pushStratToDB(scenarioId, stratData) {
  if (!coachingToken) return;
  fetch(`${API_BASE}/coaching`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
    body: JSON.stringify({ action: 'coach-data', data_type: 'strat', data_key: String(scenarioId), data_value: stratData })
  }).catch(() => {});
}

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
    authShowForm('register');
  });
  document.getElementById('auth-toggle-login')?.addEventListener('click', () => {
    authShowForm('login');
  });
  // MFA verify (code login)
  document.getElementById('auth-mfa-btn')?.addEventListener('click', globalMfaVerify);
  document.getElementById('auth-mfa-code')?.addEventListener('keydown', e => { if (e.key === 'Enter') globalMfaVerify(); });
  document.getElementById('auth-mfa-back')?.addEventListener('click', () => authShowForm('login'));
  // MFA setup (premier lancement)
  document.getElementById('auth-mfa-setup-btn')?.addEventListener('click', globalMfaEnable);
  document.getElementById('auth-mfa-setup-code')?.addEventListener('keydown', e => { if (e.key === 'Enter') globalMfaEnable(); });
  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', globalLogout);

  // Check existing session
  globalCheckSession();
}

// Affiche uniquement le formulaire demandé
function authShowForm(name) {
  ['login','register','mfa','mfa-setup'].forEach(f => {
    const el = document.getElementById(`auth-${f}-form`);
    if (el) el.style.display = f === name ? 'block' : 'none';
  });
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
      // Cloud sync on session restore
      if (typeof onLoginSync === 'function') setTimeout(() => onLoginSync(), 500);
    } else {
      localStorage.removeItem('ch_token');
      coachingToken = null;
    }
  } catch (e) { /* ignore */ }
}

// Partial token stocké pendant l'étape MFA
let _mfaPartialToken = null;
let _mfaPendingUser  = null;

async function globalLogin() {
  const email = document.getElementById('auth-login-email').value.trim();
  const pw    = document.getElementById('auth-login-password').value;
  const err   = document.getElementById('auth-login-error');
  if (!email || !pw) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  try {
    const res  = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    err.style.display = 'none';
    _mfaPartialToken = data.partial_token;
    _mfaPendingUser  = data.user || null;
    if (data.mfa_required) {
      authShowForm('mfa');
      document.getElementById('auth-mfa-code').value = '';
      document.getElementById('auth-mfa-error').style.display = 'none';
    } else if (data.mfa_setup_required) {
      await globalMfaSetupLoad();
    } else if (data.token) {
      // Connexion directe (étudiant sans MFA)
      authFinalize(data.token, data.user);
    }
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

async function globalRegister() {
  const username = document.getElementById('auth-reg-username').value.trim();
  const email    = document.getElementById('auth-reg-email').value.trim();
  const pw       = document.getElementById('auth-reg-password').value;
  const pw2      = document.getElementById('auth-reg-password2').value;
  const err      = document.getElementById('auth-reg-error');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const rank      = document.getElementById('auth-reg-rank')?.value;
  const peak_elo  = document.getElementById('auth-reg-peak')?.value || null;
  const objective = document.getElementById('auth-reg-objective')?.value?.trim() || null;
  if (!email || !pw || !username) { err.textContent = 'Remplis tous les champs'; err.style.display = 'block'; return; }
  if (!EMAIL_RE.test(email)) { err.textContent = 'Adresse email invalide'; err.style.display = 'block'; return; }
  if (!rank) { err.textContent = 'Sélectionne ton rang actuel'; err.style.display = 'block'; return; }
  if (pw !== pw2) { err.textContent = 'Mots de passe différents'; err.style.display = 'block'; return; }
  try {
    const res  = await fetch(`${API_BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw, username, current_rank: rank, peak_elo: peak_elo ? parseInt(peak_elo) : null, objective }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    err.style.display = 'none';
    // Students get a full token directly
    authFinalize(data.token, data.user);
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

// Charge le QR et affiche le formulaire de configuration MFA
async function globalMfaSetupLoad() {
  authShowForm('mfa-setup');
  document.getElementById('auth-mfa-qr').src = '';
  document.getElementById('auth-mfa-secret').textContent = 'Chargement...';
  document.getElementById('auth-mfa-setup-code').value = '';
  document.getElementById('auth-mfa-setup-error').style.display = 'none';
  try {
    const res  = await fetch(`${API_BASE}/profile?action=mfa-setup`, { headers: { 'Authorization': `Bearer ${_mfaPartialToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('auth-mfa-qr').src        = data.qr;
    document.getElementById('auth-mfa-secret').textContent = data.secret;
  } catch (e) {
    document.getElementById('auth-mfa-secret').textContent = 'Erreur : ' + e.message;
  }
}

// Étape 2 login : vérifie le code TOTP
async function globalMfaVerify() {
  const code = document.getElementById('auth-mfa-code').value.replace(/\s/g, '');
  const err  = document.getElementById('auth-mfa-error');
  if (!code) { err.textContent = 'Entre le code'; err.style.display = 'block'; return; }
  try {
    const res  = await fetch(`${API_BASE}/login?action=mfa-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partial_token: _mfaPartialToken, code }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    _mfaPartialToken = null;
    authFinalize(data.token, data.user);
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

// Étape activation MFA : vérifie code + active + obtient full JWT
async function globalMfaEnable() {
  const code = document.getElementById('auth-mfa-setup-code').value.replace(/\s/g, '');
  const err  = document.getElementById('auth-mfa-setup-error');
  if (!code) { err.textContent = 'Entre le code de vérification'; err.style.display = 'block'; return; }
  try {
    const res  = await fetch(`${API_BASE}/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_mfaPartialToken}` }, body: JSON.stringify({ action: 'mfa-enable', code }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    _mfaPartialToken = null;
    authFinalize(data.token, data.user);
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

// Finalise l'auth : stocke le token + affiche l'app
function authFinalize(token, user) {
  coachingToken    = token;
  coachingUser     = user;
  coachingUserRole = user.role;
  localStorage.setItem('ch_token', token);
  showApp();
  // Cloud sync — pull server data then push local
  if (typeof onLoginSync === 'function') setTimeout(() => onLoginSync(), 500);
}

function globalLogout() {
  coachingToken = null;
  coachingUser = null;
  coachingUserRole = null;
  localStorage.removeItem('ch_token');
  clearInterval(_notifPollInterval);
  _notifPollInterval = null;
  clearInterval(_msgPollInterval);
  _msgPollInterval = null;
  _activeRelId = null;
  if (typeof onLogoutSync === 'function') onLogoutSync();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('auth-screen').classList.add('active');
}

// Alias used by sidebar logout button
function coachingLogout() { globalLogout(); }

// ============ ANNONCES ============

async function loadAnnouncements() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/coaching?view=announcements`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) return;
    const d = await res.json();
    renderAnnouncements(d.announcements || []);
  } catch {}
}

function renderAnnouncements(list) {
  const bar = document.getElementById('announcements-bar');
  if (!bar) return;
  if (!list.length) { bar.innerHTML = ''; return; }
  const typeStyle = {
    info:    { bg:'rgba(96,165,250,0.1)',  border:'#60a5fa', icon: icon('info', 16) },
    warning: { bg:'rgba(251,191,36,0.1)', border:'#fbbf24', icon: icon('alert-triangle', 16) },
    success: { bg:'rgba(74,222,128,0.1)', border:'#4ade80', icon: icon('check-circle', 16) },
    danger:  { bg:'rgba(255,70,85,0.1)',  border:'#ff4655', icon: icon('alert-octagon', 16) }
  };
  bar.innerHTML = list.map(a => {
    const s = typeStyle[a.type] || typeStyle.info;
    return `<div class="ann-banner" style="background:${s.bg};border-left:3px solid ${s.border}">
      <strong style="color:${s.border}">${s.icon} ${san(a.title)}</strong>
      <span class="ann-content">${san(a.content)}</span>
    </div>`;
  }).join('');
}

// ============ CSV EXPORT ============

function exportToCSV(rows, filename, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r => cols.map(c => {
    const v = r[c.key] ?? '';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportUsersCSV() {
  if (!_adminUsers.length) { alert('Charge le panel admin d\'abord.'); return; }
  exportToCSV(_adminUsers, 'utilisateurs.csv', [
    { key: 'id',           label: 'ID' },
    { key: 'username',     label: 'Pseudo' },
    { key: 'email',        label: 'Email' },
    { key: 'role',         label: 'Rôle' },
    { key: 'current_rank', label: 'Rang' },
    { key: 'peak_elo',     label: 'Peak ELO' },
    { key: 'objective',    label: 'Objectif' },
    { key: 'mfa_enabled',  label: 'MFA' },
    { key: 'created_at',   label: 'Inscription' }
  ]);
}

let _historyData = [];

function exportHistoryCSV() {
  if (!_historyData.length) { alert('Charge l\'historique d\'abord.'); return; }
  exportToCSV(_historyData, 'historique.csv', [
    { key: 'played_at',    label: 'Date' },
    { key: 'mode',         label: 'Mode' },
    { key: 'score',        label: 'Score' },
    { key: 'accuracy',     label: 'Précision %' },
    { key: 'hits',         label: 'Hits' },
    { key: 'misses',       label: 'Misses' },
    { key: 'avg_reaction', label: 'Réaction moy (ms)' },
    { key: 'best_combo',   label: 'Meilleur combo' },
    { key: 'duration',     label: 'Durée (s)' }
  ]);
}

function showApp() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('coaching-screen').classList.add('active');
  if (typeof coachingSwitchTab === 'function') coachingSwitchTab('hub-home');
  // Update user display
  const roleLabels = { admin: 'Admin', coach: 'Coach', student: 'Eleve' };
  const menuUserName = document.getElementById('menu-user-name');
  if (menuUserName) menuUserName.textContent = coachingUser.username;
  const rankEl = document.getElementById('menu-user-rank');
  if (rankEl) rankEl.innerHTML = rankBadge(coachingUser.current_rank);
  // Hero greeting name
  const heroName = document.getElementById('menu-hero-name');
  if (heroName && coachingUser) heroName.textContent = coachingUser.username || coachingUser.email?.split('@')[0] || 'Joueur';
  // Avatar initiale
  const avatarEl = document.getElementById('menu-avatar');
  if (avatarEl && coachingUser) avatarEl.textContent = (coachingUser.username || coachingUser.email || 'J')[0].toUpperCase();
  const roleBadge = document.getElementById('menu-user-role');
  if (roleBadge) { roleBadge.textContent = roleLabels[coachingUserRole] || 'Eleve'; roleBadge.className = 'user-role-badge role-' + coachingUserRole; }
  // Update coaching header (legacy, kept for safety)
  const chUserInfo = document.getElementById('ch-user-info');
  if (chUserInfo) chUserInfo.textContent = coachingUser.username + ' (' + (roleLabels[coachingUserRole] || 'Eleve') + ')';

  // Update sidebar user info
  const sidebarUsername = document.getElementById('ch-sidebar-username');
  const sidebarRole = document.getElementById('ch-sidebar-role');
  const sidebarAvatar = document.getElementById('ch-sidebar-avatar');
  if (sidebarUsername) sidebarUsername.textContent = coachingUser.username || coachingUser.email || '—';
  if (sidebarRole && coachingUserRole) {
    sidebarRole.textContent = coachingUserRole === 'admin' ? 'Admin' : coachingUserRole === 'coach' ? 'Coach' : 'Joueur';
    sidebarRole.className = 'ch-sidebar-role ' + (coachingUserRole === 'admin' ? 'role-admin' : coachingUserRole === 'coach' ? 'role-coach' : 'role-student');
  }
  if (sidebarAvatar) sidebarAvatar.textContent = (coachingUser.username || coachingUser.email || '?')[0].toUpperCase();
  // Show admin-only tab
  document.querySelectorAll('.ch-admin-tab').forEach(el => {
    el.style.display = coachingUserRole === 'admin' ? '' : 'none';
  });
  document.querySelectorAll('.ch-admin-only').forEach(el => {
    el.style.display = (coachingUserRole === 'admin' || coachingUserRole === 'coach') ? '' : 'none';
  });
  const isStaff = coachingUserRole === 'admin' || coachingUserRole === 'coach';
  document.querySelectorAll('.ch-coach-only').forEach(el => {
    el.style.display = isStaff ? (el.dataset.display || '') : 'none';
  });
  const bmCoachSection = document.getElementById('bm-coach-section');
  if (bmCoachSection) bmCoachSection.style.display = (coachingUserRole === 'coach' || coachingUserRole === 'admin') ? 'block' : 'none';
  // Init coaching platform (roles, student tabs, pending badge)
  if (typeof cpInit === 'function') setTimeout(cpInit, 0);
  // Load announcements banner
  loadAnnouncements();
  // Start notification polling
  loadNotifications();
  clearInterval(_notifPollInterval);
  _notifPollInterval = setInterval(loadNotifications, 30000);
}

// ============ COACHING INIT ============

function initCoaching() {
  // btn-coaching removed (now always in hub) — sync DB on init instead
  fetchScenariosFromDB().then(() => { if (document.getElementById('ch-scenarios')?.classList.contains('active')) coachingRenderScenarios(); });
  fetchAgentEditsFromDB();
  fetchStratsFromDB();

  document.getElementById('btn-coaching-back')?.addEventListener('click', () => {
    coachingCloseVodModal();
    coachingCloseScenarioModal();
    coachingCloseEditModal();
    
    coachingSwitchTab('hub-home');
  });

  // Event delegation on the sidebar nav — works even if buttons are added/removed
  document.querySelector('.ch-sidebar-nav')?.addEventListener('click', e => {
    const btn = e.target.closest('.ch-tab-btn');
    if (btn && btn.dataset.tab) coachingSwitchTab(btn.dataset.tab);
  });

  // Notification bell
  document.addEventListener('click', (e) => {
    const chPanel = document.getElementById('ch-notif-panel');
    if (chPanel && chPanel.style.display !== 'none' && !chPanel.contains(e.target) && e.target.id !== 'ch-notif-btn') {
      chPanel.style.display = 'none';
    }
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

  // Add scénario button
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
  if (!pSel || !aSel || !mSel) return;

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

  // Update topbar title
  const TAB_TITLES = {
    'hub-home':icon('home',16)+' Accueil',
    'hub-freeplay':icon('zap',16)+' Free Play',
    'hub-settings':icon('settings',16)+' Paramètres',
    'hub-viscose':icon('chart',16)+' Viscose Benchmark',
    'ch-dashboard':'Dashboard','ch-daily-training':icon('calendar',16)+' Daily Training','ch-daily':icon('calendar',16)+' Daily Challenge',
    'ch-historique':icon('trending-up',16)+' Historique','ch-leaderboard':icon('trophy',16)+' Classement','ch-achievements':icon('medal',16)+' Succès',
    'ch-scenarios':icon('target',16)+' Scénarios','ch-agents':icon('brain',16)+' Agents','ch-vods':icon('video',16)+' VODs',
    'ch-cours':icon('book',16)+' Cours','ch-warmup':icon('flame',16)+' Échauffement','ch-students':icon('users',16)+' Élèves',
    'ch-messages':icon('message',16)+' Messages','cp-mon-coach':icon('teacher',16)+' Mon Coach','cp-mon-plan':icon('calendar',16)+' Mon Plan',
    'cp-feedbacks':icon('feedback',16)+' Feedbacks','ch-map-editor':icon('map',16)+' Map Editor',
    'ch-manage-scenarios':icon('wrench',16)+' Gestion Scénarios','ch-admin':icon('settings',16)+' Admin',
  };
  const titleEl = document.getElementById('ch-topbar-title');
  if (titleEl) titleEl.innerHTML = TAB_TITLES[tabId] || tabId;

  if (tabId === 'hub-viscose' && typeof renderBenchmark === 'function') {
    setTimeout(() => renderBenchmark(), 50);
  }
  if (tabId === 'ch-dashboard') coachingRenderDashboard();
  if (tabId === 'ch-scenarios') coachingRenderScenarios();
  if (tabId === 'ch-agents') coachingRenderAgents();
  if (tabId === 'ch-vods') coachingRenderVods();
  if (tabId === 'ch-students') coachingRenderStudents();
  if (tabId === 'ch-cours') coachingRenderCours();
  if (tabId === 'ch-map-editor') { if (!ME.editingScenario) meUpdateScenarioBanner(); meLoadMapImg(); meRenderSteps(); meRender(); meRenderSaved(); }
  if (tabId === 'ch-manage-scenarios') coachingRenderManageScenarios();
  if (tabId === 'ch-ai-coach') initAiCoachTab();
  if (tabId === 'ch-profile') renderProfile();
  if (tabId === 'ch-historique') { coachingRenderHistory(); loadPbHistory(); }
  if (tabId === 'ch-leaderboard') {
    // Populate mode select
    const sel = document.getElementById('lb-mode-select');
    if (sel && !sel.dataset.populated) {
      sel.dataset.populated = '1';
      sel.innerHTML = LB_MODES.map(([v,l]) => `<option value="${v}"${v===_lbMode?' selected':''}>${l}</option>`).join('');
    }
    switchLbTab(_lbActiveTab || 'global');
  }
  if (tabId === 'ch-daily-training') { dailyTrainingLoad(); renderWeeklyChallenges(); }
  if (tabId === 'ch-warmup') initWarmupPanel();
  if (tabId === 'hub-settings') settMfaRefresh();
  if (tabId === 'ch-tracker')   trackerTabLoad();
  if (tabId === 'ch-admin') adminLoad();
  if (tabId === 'ch-daily') loadDailyChallenge();
  if (tabId === 'ch-messages') initMessagesTab();
  if (tabId === 'ch-achievements') renderAchievements();
  if (tabId === 'cp-mon-coach')  { if (typeof cpLoadMyCoach   === 'function') cpLoadMyCoach(); }
  if (tabId === 'cp-mon-plan')   { if (typeof cpLoadPlan === 'function') cpLoadPlan(); localStorage.setItem('visc_last_seen_plan', new Date().toISOString()); const b = document.getElementById('badge-plan'); if (b) b.style.display='none'; }
  if (tabId === 'cp-feedbacks')  { if (typeof cpLoadFeedbacks === 'function') cpLoadFeedbacks(); localStorage.setItem('visc_last_seen_fb', new Date().toISOString()); const b = document.getElementById('badge-feedback'); if (b) b.style.display='none'; }
  if (tabId === 'ch-students')   { if (typeof cpLoadPlayers   === 'function') cpLoadPlayers(); }
}

// ============ DASHBOARD ============

let _dashSparkline = null;

async function coachingRenderDashboard() {
  // Immediate local values
  const el = (id) => document.getElementById(id);

  try {
    const res = await fetch(`${API_BASE}/coaching?view=dashboard-stats`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) throw new Error();
    const d = await res.json();
    const s = d.stats || {};

    // Stat cards
    el('ch-dash-games').textContent    = s.total_games ?? '—';
    el('ch-dash-best').textContent     = s.best_score   ? Number(s.best_score).toLocaleString() : '—';
    el('ch-dash-avg').textContent      = s.avg_score    ? Number(s.avg_score).toLocaleString()  : '—';
    el('ch-dash-accuracy').textContent = s.avg_accuracy != null ? s.avg_accuracy + '%' : '—';
    el('ch-dash-rank').textContent     = d.rank         ? '#' + d.rank : '—';
    el('ch-dash-streak').textContent   = s.streak != null ? s.streak + (s.streak === 1 ? ' jour' : ' jours') : '—';

    // Sparkline 7j
    _renderDashSparkline(d.activity || []);

    // Dernière partie
    const lgEl = el('dash-last-game');
    if (lgEl) {
      if (d.last_game) {
        const lg = d.last_game;
        const date = new Date(lg.played_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        lgEl.innerHTML = `<span class="dash-last-label">Dernière partie :</span>
          <span class="dash-last-mode">${san(lg.mode.replace(/_/g,' '))}</span>
          <span class="dash-last-score">${Number(lg.score).toLocaleString()}</span>
          ${lg.accuracy != null ? `<span class="dash-last-acc">${lg.accuracy}% précision</span>` : ''}
          <span class="dash-last-date">${date}</span>`;
      } else {
        lgEl.innerHTML = '';
      }
    }

    // Plan actif
    const planEl = el('dash-plan-content');
    if (planEl) {
      if (d.plan) {
        const p = d.plan;
        const pct = p.scenarios_total > 0 ? Math.round((p.scenarios_done / p.scenarios_total) * 100) : 0;
        planEl.innerHTML = `
          <div class="dash-plan-title">${san(p.title)}</div>
          ${p.description ? `<div class="dash-plan-desc">${san(p.description)}</div>` : ''}
          <div class="dash-plan-progress-bar"><div class="dash-plan-progress-fill" style="width:${pct}%"></div></div>
          <div class="dash-plan-pct">${p.scenarios_done} / ${p.scenarios_total} scénarios &mdash; ${pct}%</div>
          ${p.target_scenario ? `<div class="dash-plan-target">${icon('target',14)} Objectif : ${san(p.target_scenario)}</div>` : ''}`;
      } else {
        planEl.innerHTML = '<p class="ch-empty" style="font-size:0.82rem;padding:8px 0">Aucun plan actif</p>';
      }
    }

    // Dernier feedback
    const fbEl = el('dash-feedback-content');
    if (fbEl) {
      if (d.last_feedback) {
        const f = d.last_feedback;
        const date = new Date(f.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        fbEl.innerHTML = `
          <div class="dash-fb-coach">Par ${san(f.coach_username)} &middot; <span style="color:var(--dim)">${date}</span></div>
          <p class="dash-fb-content">${san(f.content)}</p>
          ${f.week_objective ? `<div class="dash-fb-obj">${icon('target',14)} ${san(f.week_objective)}</div>` : ''}`;
      } else {
        fbEl.innerHTML = '<p class="ch-empty" style="font-size:0.82rem;padding:8px 0">Aucun feedback reçu</p>';
      }
    }

  } catch {
    // silently fail — dashboard still shows local data
  }
}

function _renderDashSparkline(activity) {
  const canvas = document.getElementById('dash-sparkline');
  if (!canvas || !window.Chart) return;
  if (_dashSparkline) { _dashSparkline.destroy(); _dashSparkline = null; }

  // Build 7-day labels
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = {};
  activity.forEach(a => { byDay[a.day.slice(0, 10)] = a; });

  const labels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }));
  const games  = days.map(d => byDay[d]?.games || 0);
  const bests  = days.map(d => byDay[d]?.best  || 0);

  _dashSparkline = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Parties', data: games, backgroundColor: 'rgba(255,70,85,0.5)', borderColor: '#ff4655', borderWidth: 1, borderRadius: 3, yAxisID: 'y1' },
        { label: 'Meilleur score', data: bests, type: 'line', borderColor: '#60a5fa', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#60a5fa', yAxisID: 'y2', tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10 } } },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y1: { position: 'left', ticks: { color: '#8b949e', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true },
        y2: { position: 'right', ticks: { color: '#60a5fa', font: { size: 9 } }, grid: { display: false }, beginAtZero: true }
      }
    }
  });
}

// ============ scenarios ============

// ── Scenario completion persistence ──
function getCompletedscenarios() {
  try { return JSON.parse(localStorage.getItem('valAim_completedScenarios') || '[]'); } catch { return []; }
}
function markScenarioCompleted(id) {
  const list = getCompletedscenarios();
  if (!list.includes(id)) { list.push(id); localStorage.setItem('valAim_completedScenarios', JSON.stringify(list)); }
}

// ══════════════════════════════════════════════════════════════════
// QCM FLASHCARD QUIZ SYSTEM
// ══════════════════════════════════════════════════════════════════

// Generate 2-3 QCM questions per scenario from guide + tips
const SCENARIO_QCM = {};
function _qcmBuild() {
  if (Object.keys(SCENARIO_QCM).length) return;
  // Hand-crafted questions per scenario ID
  const Q = {
    1: [
      { q: "Lors d'un B execute via Hookah sur Bind, quel est le premier angle à smoker ?", choices: ["CT (sortie hookah)", "B main", "U-Hall", "Le mid"], answer: 0 },
      { q: "En sortant de hookah sur Bind, quel est le premier réflexe ?", choices: ["Regarder à gauche", "Pre-aim CT immédiatement", "Planter le spike", "Rotater vers A"], answer: 1 },
      { q: "Quel est le meilleur spot de plant sur B Bind ?", choices: ["Au centre du site", "Derrière la grande boîte", "Dans hookah", "À l'entrée CT"], answer: 1 },
    ],
    2: [
      { q: "En défense A Short sur Bind, quelle est la position la plus forte ?", choices: ["Showers", "Le coin CT", "A main", "B site"], answer: 1 },
      { q: "Quand faut-il peeker en défense A sur Bind ?", choices: ["Dès le début du round", "Quand on entend des pas", "Attendre le crossfire short + elbow", "Après le plant"], answer: 2 },
      { q: "Où le sentinel doit-il placer son trip sur A Bind ?", choices: ["Au pied de short A", "Dans showers", "En CT", "Sur B site"], answer: 0 },
    ],
    3: [
      { q: "Pour le retake B sur Bind, quel est l'atout principal ?", choices: ["Le smoke CT", "Le TP showers", "Le flash B main", "L'ulti du duelist"], answer: 1 },
      { q: "Que faut-il smoker pendant le retake B Bind ?", choices: ["B main", "CT", "U-Hall (hookah)", "Le mid"], answer: 2 },
      { q: "Quand peut-on defuser sur un retake B Bind ?", choices: ["Dès qu'on arrive sur site", "Après avoir posé le smoke", "Une fois le site entièrement clear", "Pendant le flash"], answer: 2 },
    ],
    4: [
      { q: "Sur C Haven, quel est l'unique angle vraiment dangereux à smoker ?", choices: ["C long", "CT", "Garage", "C right"], answer: 1 },
      { q: "Pourquoi faut-il planter vite sur C Haven ?", choices: ["Le spike a un timer court", "Les rotations depuis A sont rapides", "Le site est petit", "Il n'y a pas de couverture"], answer: 1 },
      { q: "Quel coin est souvent oublié par les attaquants sur C Haven ?", choices: ["CT", "C long", "C right", "Garage"], answer: 2 },
    ],
    5: [
      { q: "Qui contrôle les rotations sur Haven ?", choices: ["Celui qui tient A", "Celui qui contrôle mid", "Celui qui défend C", "Le sentinel"], answer: 1 },
      { q: "Où le sentinel doit-il placer son trip pour contrôler mid Haven ?", choices: ["Garage", "Sur la porte B mid", "Window", "C long"], answer: 1 },
      { q: "Quand utiliser la smoke d'urgence en défense mid Haven ?", choices: ["En début de round", "Quand le controller le décide", "En urgence uniquement", "Après chaque kill"], answer: 2 },
    ],
    6: [
      { q: "Pour le retake A Haven, par quels chemins faut-il pincer ?", choices: ["Long A + Short A", "CT + Mid", "Garage + C", "B + Mid"], answer: 0 },
      { q: "Quel est l'angle de post-plant le plus utilisé sur A Haven ?", choices: ["Short A", "Long A", "CT box", "Garage"], answer: 1 },
      { q: "Quelle est la clé du retake A sur Haven ?", choices: ["La quantité d'utils", "La coordination timing entre les deux joueurs", "L'aim individuel", "Le nombre de joueurs"], answer: 1 },
    ],
    7: [
      { q: "Sur B Split, quelle smoke est non-négociable pour monter heaven ?", choices: ["B main", "B window", "B heaven", "CT"], answer: 2 },
      { q: "Depuis heaven sur B Split, que doit faire le joueur ?", choices: ["Planter immédiatement", "Caller chaque position", "Peeker seul", "Rotater mid"], answer: 1 },
      { q: "Quel angle est souvent oublié par les attaquants sur B Split ?", choices: ["CT", "Heaven", "Back-B", "Mid"], answer: 2 },
    ],
    8: [
      { q: "Quel crossfire rend l'entrée A Split quasiment impossible ?", choices: ["CT + Mid", "Ropes + Main", "Heaven + CT", "Screen + Ramp"], answer: 1 },
      { q: "Que faire si une flash est détectée en position ropes sur A Split ?", choices: ["Peeker immédiatement", "Reculer", "Rester immobile", "Smoker"], answer: 1 },
      { q: "Quel est le flank le plus dangereux sur A Split ?", choices: ["B main", "Mid", "Heaven", "Sewer"], answer: 2 },
    ],
    9: [
      { q: "Quel est le spot de post-plant préféré sur B Split ?", choices: ["CT", "Back-B", "Heaven", "Mid"], answer: 1 },
      { q: "Depuis où window donne un angle surprenant sur B Split ?", choices: ["Mid", "CT", "B main", "Heaven"], answer: 0 },
      { q: "Quand ne faut-il jamais defuser sur B Split ?", choices: ["Si CT n'est pas clear", "Si back-B n'est pas confirmé clear", "Si heaven est pris", "Si mid est ouvert"], answer: 1 },
    ],
    10: [
      { q: "Quel est l'angle le plus mortel de A Lotus ?", choices: ["Root", "La porte", "Tree", "Stone"], answer: 2 },
      { q: "Que doit TOUJOURS smoker en premier le controller sur A Lotus ?", choices: ["Root", "CT", "Tree", "La porte"], answer: 2 },
      { q: "Pourquoi casser la porte sur A Lotus est stratégique ?", choices: ["Ça fait des dégâts", "Le bruit peut masquer le timing d'entrée", "Ça bloque le passage", "Ça donne de l'info"], answer: 1 },
    ],
    11: [
      { q: "Quelle est la position dominante de C Lotus ?", choices: ["C link", "C main", "Mound", "CT"], answer: 2 },
      { q: "Que faire après avoir tiré depuis mound sur C Lotus ?", choices: ["Rester en place", "Se repositionner", "Planter", "Rotater"], answer: 1 },
      { q: "Quelle est l'info la plus précieuse en défense C Lotus ?", choices: ["Le call du mid", "Le trip sentinel à l'entrée C", "Les pas ennemis", "Le son du spike"], answer: 1 },
    ],
    12: [
      { q: "Par quel chemin inattendu retake B Lotus ?", choices: ["C connection", "B main", "A link", "CT"], answer: 2 },
      { q: "Quel est le meilleur spot de défense post-plant sur B Lotus ?", choices: ["B main", "Le rocher central", "CT", "C connection"], answer: 1 },
    ],
    13: [
      { q: "En sortie de tunnel sur B Breeze, quel angle est le plus dangereux ?", choices: ["Arco", "Mid B", "CT", "Le centre du site"], answer: 2 },
      { q: "Quel coin est souvent oublié mais fréquemment tenu sur B Breeze ?", choices: ["CT", "Mid", "Arco", "Tunnel"], answer: 2 },
    ],
    14: [
      { q: "Quel setup défensif est un des plus forts du jeu sur A Breeze ?", choices: ["Trip sur main", "Le mur Viper en diagonale", "L'orbe Sage", "La smoke Brimstone"], answer: 1 },
      { q: "Quel avantage donne le mur Viper sur A Breeze ?", choices: ["Il bloque les balles", "Un avantage informationnel (one-way)", "Il fait des dégâts", "Il ralentit les ennemis"], answer: 1 },
    ],
    15: [
      { q: "Quel est l'angle de retake le plus rapide et inattendu sur A Breeze ?", choices: ["CT", "Main", "Cave", "Mid"], answer: 2 },
      { q: "Quelle est la seule couverture sur A Breeze pour le défuse ?", choices: ["Le mur", "Le pilier", "La caisse", "La porte"], answer: 1 },
    ],
    16: [
      { q: "Quelle position est très agressive sur B Fracture et doit être smokée ?", choices: ["CT B", "Arcade", "Dish", "Escaliers"], answer: 2 },
      { q: "Quel coin est souvent oublié mais régulièrement tenu sur B Fracture ?", choices: ["CT", "Dish", "Le coin escaliers", "Arcade"], answer: 2 },
    ],
    17: [
      { q: "Quelle est la meilleure position offensive de A Fracture ?", choices: ["A main", "CT", "Dish", "Heaven"], answer: 2 },
      { q: "Quelle est l'info la plus précieuse en défense A Fracture ?", choices: ["Les pas mid", "Le trip sentinel sur arcade", "Le son de la rope", "La call B"], answer: 1 },
    ],
    18: [
      { q: "Qu'est-ce qui rend l'entrée par la corde sur B Fracture efficace en retake ?", choices: ["La vitesse", "L'effet de surprise total", "La hauteur", "La couverture"], answer: 1 },
      { q: "Quel est le spot de post-plant le plus utilisé sur B Fracture ?", choices: ["Arcade", "Rope side", "CT B", "Dish"], answer: 2 },
    ],
    19: [
      { q: "Quel est l'unique angle vraiment dangereux en entrant B Pearl ?", choices: ["B screens", "La colonne", "CT B", "B main"], answer: 2 },
      { q: "Quelle est la meilleure couverture pour planter sur B Pearl ?", choices: ["B screens", "La colonne centrale", "Le mur", "L'entrée"], answer: 1 },
    ],
    20: [
      { q: "Quelle est la position la plus forte de A Pearl ?", choices: ["Art", "Link", "CT", "Mid"], answer: 2 },
      { q: "Que donne gratuitement le trip sur link en défense A Pearl ?", choices: ["Du temps", "De l'info dès le début du round", "Des dégâts", "Un avantage numérique"], answer: 1 },
    ],
    21: [
      { q: "Quel est l'angle de post-plant le plus populaire sur A Pearl ?", choices: ["Art", "CT", "Link", "Mid"], answer: 1 },
      { q: "Que faut-il faire avant d'approcher CT en retake A Pearl ?", choices: ["Planter", "Smoker", "Flash", "Run"], answer: 2 },
    ],
    22: [
      { q: "En défense B Bind, où le sentinel doit-il placer son trip ?", choices: ["B main", "CT", "À l'entrée de hookah", "U-Hall"], answer: 2 },
      { q: "Quelle est la position dominante en défense B Bind ?", choices: ["Hookah", "U-Hall", "CT B", "B main"], answer: 2 },
      { q: "Pourquoi ne faut-il jamais avancer seul dans hookah en défense ?", choices: ["C'est trop long", "C'est un piège mortel", "Il n'y a pas de couverture", "Les rotations sont lentes"], answer: 1 },
    ],
    23: [
      { q: "Quelle position donne un avantage de hauteur décisif sur A Haven ?", choices: ["Short A", "CT", "Heaven A", "Long A"], answer: 2 },
      { q: "Où le sentinel doit-il placer son trip en défense A Haven ?", choices: ["Short A", "A long", "Heaven", "CT"], answer: 1 },
      { q: "Si les attaquants push A main sur Haven, qui engage en premier ?", choices: ["Short A", "Heaven", "CT", "Le sentinel"], answer: 1 },
    ],
    24: [
      { q: "Par quels chemins retake A sur Split dans ce scénario ?", choices: ["CT + Mid", "CT + Heaven", "Ramp + Main", "Sewer + CT"], answer: 1 },
      { q: "Quel coin faut-il smoker si un défenseur y est probable en retake A Split ?", choices: ["Heaven", "CT", "Ramp", "Screen"], answer: 2 },
      { q: "Pourquoi heaven est-il dévastateur en retake A Split ?", choices: ["Il donne du cover", "L'angle élevé est impossible à ignorer", "Il bloque les rotations", "Il donne de l'info"], answer: 1 },
    ],
    25: [
      { q: "Quel angle inattendu utiliser pour retake A Lotus ?", choices: ["Tree side", "Root", "La porte cassée", "C link"], answer: 2 },
      { q: "Quel est le meilleur spot de défuse sur A Lotus ?", choices: ["Root corner", "Tree side", "Derrière le stone", "La porte"], answer: 2 },
      { q: "Que faut-il confirmer clear avant de defuse sur A Lotus ?", choices: ["Root ET tree", "CT ET main", "Door ET link", "Mound ET root"], answer: 0 },
    ],
    26: [
      { q: "Quel est l'angle le plus mortel de A Breeze depuis mid door ?", choices: ["Cave", "CT A", "Pyramide", "Le pilier"], answer: 2 },
      { q: "Quel coin est souvent tenu agressivement sur A Breeze ?", choices: ["CT", "Mid door", "Cave", "Pyramide"], answer: 2 },
    ],
    27: [
      { q: "Quel est l'angle le plus dangereux sur A Ascent ?", choices: ["Generator", "Hell", "Heaven", "CT"], answer: 2 },
      { q: "Quel est le meilleur spot de plant sur A Ascent ?", choices: ["Au centre du site", "Derrière generator", "Dans hell", "Près de heaven"], answer: 1 },
      { q: "Quel coin est souvent oublié par les attaquants sur A Ascent ?", choices: ["Heaven", "CT", "Hell", "Generator"], answer: 2 },
    ],
    28: [
      { q: "Quel angle est non-négociable à smoker en entrant B Ascent ?", choices: ["Market", "Lane", "CT B", "Back-site"], answer: 2 },
      { q: "Quelle est la route de rotation principale vers B Ascent ?", choices: ["CT", "Mid", "Market", "Lane"], answer: 2 },
      { q: "Quel angle est souvent tenu agressivement sur B Ascent ?", choices: ["CT", "Back-site", "Lane", "Market"], answer: 2 },
    ],
    29: [
      { q: "Qui contrôle les splits A et B sur Ascent ?", choices: ["Celui qui tient A", "Celui qui contrôle mid", "Celui qui défend B", "Le sentinel"], answer: 1 },
      { q: "Où le sentinel doit-il placer son trip pour contrôler mid Ascent ?", choices: ["Top mid", "Bottom mid", "Catwalk", "Market door"], answer: 1 },
      { q: "Pourquoi ne faut-il jamais avancer top mid sans info sur Ascent ?", choices: ["C'est trop loin", "C'est un death trap", "Les rotations sont lentes", "Il n'y a pas de smoke"], answer: 1 },
    ],
    30: [
      { q: "Quel angle de retake est bas et inattendu sur A Ascent ?", choices: ["CT", "Heaven", "Hell", "Generator"], answer: 2 },
      { q: "Quel est le spot de post-plant le plus populaire sur A Ascent ?", choices: ["Hell", "CT", "Generator", "Heaven"], answer: 2 },
      { q: "Que faut-il faire avant d'entrer par CT en retake A Ascent ?", choices: ["Planter", "Smoker generator", "Flash", "Attendre"], answer: 2 },
    ],
    31: [
      { q: "Quelle est la position la plus forte de A Icebox ?", choices: ["Belt", "Nest", "Rafters", "Pipes"], answer: 2 },
      { q: "Quel spot de plant permet de surveiller depuis belt en post-plant ?", choices: ["Le coin pipes", "Le spot default", "Derrière le container", "Près de nest"], answer: 1 },
      { q: "Quel coin est souvent tenu par un sentinel sur A Icebox ?", choices: ["Belt", "Pipes", "Nest", "Rafters"], answer: 2 },
    ],
    32: [
      { q: "Quel angle est le plus dangereux en entrant B Icebox ?", choices: ["Yellow", "Green", "Kitchen", "CT B"], answer: 3 },
      { q: "Quel coin est fréquemment oublié mais occupé par un sentinel sur B Icebox ?", choices: ["Yellow", "Green", "Kitchen", "CT"], answer: 1 },
    ],
    33: [
      { q: "Quel crossfire est la clé de la défense B Icebox ?", choices: ["CT + Green", "Yellow + Kitchen", "Orange + CT", "Green + Yellow"], answer: 1 },
      { q: "Quelle est l'info la plus précieuse en défense B Icebox ?", choices: ["Les pas mid", "Le call A", "Le trip orange", "Le son de la rope"], answer: 2 },
      { q: "Que faire si une flash est annoncée en position yellow ?", choices: ["Peeker", "Reculer", "Rester immobile", "Avancer"], answer: 1 },
    ],
    34: [
      { q: "Pourquoi la pince rafters + belt est difficile à contrer sur A Icebox ?", choices: ["La vitesse", "La différence de hauteur", "Le nombre de joueurs", "Les smokes"], answer: 1 },
      { q: "Quel angle est dominant en retake A Icebox ?", choices: ["Belt", "Nest", "Rafters", "Pipes"], answer: 2 },
    ],
    35: [
      { q: "Quel est l'angle le plus mortel de A Sunset ?", choices: ["Heaven", "Back-site", "Elbow", "CT"], answer: 2 },
      { q: "Quel angle élevé est dangereux sur A Sunset ?", choices: ["CT", "Elbow", "Heaven", "Main"], answer: 2 },
      { q: "Quel est le meilleur spot de plant pour le post-plant depuis main sur A Sunset ?", choices: ["Au centre", "Derrière la structure centrale", "Dans le coin", "Près de heaven"], answer: 1 },
    ],
    36: [
      { q: "Quel crossfire est la clé de la défense B Sunset ?", choices: ["CT + Main", "Market + CT", "Heaven + CT", "Market + Main"], answer: 1 },
      { q: "Quelle est la position agressive en défense B Sunset ?", choices: ["CT", "B main", "Market", "Heaven"], answer: 2 },
      { q: "Que donne le trip B main en défense B Sunset ?", choices: ["Des dégâts", "Du temps", "De l'info gratuite", "Un avantage numérique"], answer: 2 },
    ],
    37: [
      { q: "Pourquoi le mid de Sunset est-il crucial ?", choices: ["Il donne des kills", "Il contrôle les rotations", "Il est facile à tenir", "Il donne du cover"], answer: 1 },
      { q: "Quelle est l'entrée la plus sûre pour reprendre mid sur Sunset ?", choices: ["Top mid", "Courtyard", "B main", "A main"], answer: 1 },
      { q: "Que faut-il toujours utiliser avant d'entrer mid sur Sunset ?", choices: ["Un smoke", "Un flash", "Un drone ou une haunt", "Un molly"], answer: 2 },
    ],
    38: [
      { q: "Quelle est la position dominante de B Abyss ?", choices: ["CT B", "Pillar", "Heaven B", "B main"], answer: 2 },
      { q: "Quel est le meilleur cover de plant sur B Abyss ?", choices: ["CT", "Heaven", "Pillar", "B main"], answer: 2 },
      { q: "Quel danger unique existe sur Abyss par rapport aux autres maps ?", choices: ["Les téléporteurs", "Les portes", "Les chutes mortelles", "Les cordes"], answer: 2 },
    ],
    39: [
      { q: "Quelle est la position la plus forte de A Abyss ?", choices: ["CT A", "A main", "Bridge", "Heaven"], answer: 2 },
      { q: "Quel crossfire rend l'entrée A difficile sur Abyss ?", choices: ["CT + Main", "Bridge + CT", "Heaven + Bridge", "Main + Heaven"], answer: 1 },
      { q: "Que faut-il surveiller en permanence sur Abyss ?", choices: ["Les téléporteurs", "Les bords du vide", "Les cordes", "Les portes"], answer: 1 },
    ],
    40: [
      { q: "Quel angle de retake est décisif sur B Abyss ?", choices: ["CT", "B main", "Heaven", "Pillar"], answer: 2 },
      { q: "Que faut-il smoker en retake B Abyss si un défenseur est probable ?", choices: ["CT", "Heaven", "Pillar", "B main"], answer: 2 },
      { q: "Quel danger spécifique existe pendant le retake B sur Abyss ?", choices: ["Les flashs", "Les knockbacks près des bords", "Les rotations rapides", "Les smokes ennemies"], answer: 1 },
    ],
  };
  for (const [id, questions] of Object.entries(Q)) {
    SCENARIO_QCM[+id] = questions;
  }
  // Merge custom QCM from localStorage (overrides defaults)
  try {
    const custom = JSON.parse(localStorage.getItem('valAim_customQCM') || '{}');
    for (const [id, questions] of Object.entries(custom)) {
      SCENARIO_QCM[+id] = questions;
    }
  } catch {}
}

// ── QCM CRUD ──
function _qcmSaveCustom() {
  // Save all QCM to localStorage (so edits persist)
  localStorage.setItem('valAim_customQCM', JSON.stringify(SCENARIO_QCM));
}

function _qcmAddQuestion(scenarioId, question) {
  if (!SCENARIO_QCM[scenarioId]) SCENARIO_QCM[scenarioId] = [];
  SCENARIO_QCM[scenarioId].push(question);
  _qcmSaveCustom();
}

function _qcmEditQuestion(scenarioId, qIndex, question) {
  if (!SCENARIO_QCM[scenarioId]?.[qIndex]) return;
  SCENARIO_QCM[scenarioId][qIndex] = question;
  _qcmSaveCustom();
}

function _qcmDeleteQuestion(scenarioId, qIndex) {
  if (!SCENARIO_QCM[scenarioId]) return;
  SCENARIO_QCM[scenarioId].splice(qIndex, 1);
  if (!SCENARIO_QCM[scenarioId].length) delete SCENARIO_QCM[scenarioId];
  _qcmSaveCustom();
}

// ── QCM Management Modal ──
function _qcmOpenManager(scenarioId) {
  _qcmBuild();
  const s = coachingScenarios.find(sc => sc.id === scenarioId);
  if (!s) return;
  const questions = SCENARIO_QCM[scenarioId] || [];

  const content = document.createElement('div');
  content.className = 'qcm-manager';

  function render() {
    const qs = SCENARIO_QCM[scenarioId] || [];
    content.innerHTML = `
      <div class="qcm-mgr-list">
        ${qs.length ? qs.map((q, i) => `
          <div class="qcm-mgr-item">
            <div class="qcm-mgr-q">
              <span class="qcm-mgr-num">Q${i+1}</span>
              <span>${san(q.q)}</span>
            </div>
            <div class="qcm-mgr-choices">
              ${q.choices.map((c, ci) => `<span class="qcm-mgr-choice ${ci === q.answer ? 'qcm-mgr-choice--correct' : ''}">${'ABCD'[ci]}. ${san(c)}</span>`).join('')}
            </div>
            <div class="qcm-mgr-actions">
              <button class="qcm-mgr-btn qcm-mgr-btn-edit" data-idx="${i}">${icon('edit',14)} Modifier</button>
              <button class="qcm-mgr-btn qcm-mgr-btn-del" data-idx="${i}">${icon('trash',14)} Supprimer</button>
            </div>
          </div>
        `).join('') : '<p style="color:var(--dim);text-align:center;padding:20px 0">Aucune question pour ce scénario</p>'}
      </div>
      <button class="qcm-mgr-add-btn" id="qcm-mgr-add">+ Ajouter une question</button>
    `;

    // Bind events
    content.querySelectorAll('.qcm-mgr-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => _qcmOpenEditor(scenarioId, +btn.dataset.idx, render));
    });
    content.querySelectorAll('.qcm-mgr-btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Supprimer cette question ?')) return;
        _qcmDeleteQuestion(scenarioId, +btn.dataset.idx);
        showToast.success('Question supprimée');
        render();
      });
    });
    content.querySelector('#qcm-mgr-add')?.addEventListener('click', () => {
      _qcmOpenEditor(scenarioId, -1, render);
    });
  }

  render();

  showModal({
    title: `${icon('edit',16)} QCM — ${s.title}`,
    content,
    size: 'lg',
  });
}

function _qcmOpenEditor(scenarioId, qIndex, onSave) {
  const existing = qIndex >= 0 ? SCENARIO_QCM[scenarioId]?.[qIndex] : null;
  const isNew = !existing;

  const form = document.createElement('div');
  form.className = 'qcm-editor';
  form.innerHTML = `
    <div class="qcm-ed-field">
      <label>Question</label>
      <textarea id="qcm-ed-q" rows="2" placeholder="Ex: Pour attaquer A sur Haven, quel angle faut-il smoker en premier ?">${existing ? san(existing.q) : ''}</textarea>
    </div>
    <div class="qcm-ed-field">
      <label>Choix A</label>
      <input id="qcm-ed-a" type="text" value="${existing ? san(existing.choices[0] || '') : ''}" placeholder="Réponse A">
    </div>
    <div class="qcm-ed-field">
      <label>Choix B</label>
      <input id="qcm-ed-b" type="text" value="${existing ? san(existing.choices[1] || '') : ''}" placeholder="Réponse B">
    </div>
    <div class="qcm-ed-field">
      <label>Choix C</label>
      <input id="qcm-ed-c" type="text" value="${existing ? san(existing.choices[2] || '') : ''}" placeholder="Réponse C">
    </div>
    <div class="qcm-ed-field">
      <label>Choix D</label>
      <input id="qcm-ed-d" type="text" value="${existing ? san(existing.choices[3] || '') : ''}" placeholder="Réponse D">
    </div>
    <div class="qcm-ed-field">
      <label>Bonne réponse</label>
      <select id="qcm-ed-answer">
        <option value="0" ${existing?.answer === 0 ? 'selected' : ''}>A</option>
        <option value="1" ${existing?.answer === 1 ? 'selected' : ''}>B</option>
        <option value="2" ${existing?.answer === 2 ? 'selected' : ''}>C</option>
        <option value="3" ${existing?.answer === 3 ? 'selected' : ''}>D</option>
      </select>
    </div>
    <div id="qcm-ed-error" style="color:#ff4655;font-size:0.82rem;display:none;margin-bottom:8px"></div>
    <button class="btn-primary" id="qcm-ed-save" style="width:100%">${isNew ? 'Ajouter' : 'Sauvegarder'}</button>
  `;

  const modal = showModal({
    title: isNew ? icon('plus',16)+' Nouvelle question' : icon('edit',16)+' Modifier la question',
    content: form,
    size: 'md',
  });

  form.querySelector('#qcm-ed-save').addEventListener('click', () => {
    const q = document.getElementById('qcm-ed-q').value.trim();
    const choices = [
      document.getElementById('qcm-ed-a').value.trim(),
      document.getElementById('qcm-ed-b').value.trim(),
      document.getElementById('qcm-ed-c').value.trim(),
      document.getElementById('qcm-ed-d').value.trim(),
    ];
    const answer = +document.getElementById('qcm-ed-answer').value;
    const errEl = document.getElementById('qcm-ed-error');

    if (!q) { errEl.textContent = 'La question est requise'; errEl.style.display = 'block'; return; }
    if (choices.filter(c => c).length < 2) { errEl.textContent = 'Au moins 2 choix sont requis'; errEl.style.display = 'block'; return; }
    // Filter out empty choices and adjust answer index
    const validChoices = choices.filter(c => c);
    const adjustedAnswer = Math.min(answer, validChoices.length - 1);

    const question = { q, choices: validChoices, answer: adjustedAnswer };

    if (isNew) {
      _qcmAddQuestion(scenarioId, question);
      showToast.success('Question ajoutée !');
    } else {
      _qcmEditQuestion(scenarioId, qIndex, question);
      showToast.success('Question modifiée !');
    }
    modal.close();
    if (onSave) onSave();
  });
}

// ── Quiz state ──
let _qcmFiltered = [];
let _qcmIndex = 0;
let _qcmScore = { correct: 0, total: 0 };
let _qcmAnswered = false;

function coachingRenderScenarios() {
  _qcmBuild();
  const rank = document.getElementById('ch-rank-filter')?.value || '';
  const map = document.getElementById('ch-map-filter')?.value || '';
  const type = document.getElementById('ch-type-filter')?.value || '';

  const RANK_ORDER = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','ASCENDANT','IMMORTAL','RADIANT'];
  let filtered = coachingScenarios;
  if (rank) filtered = filtered.filter(s => s.rank === rank);
  if (map) filtered = filtered.filter(s => s.map === map);
  if (type) filtered = filtered.filter(s => s.type === type);
  filtered = [...filtered].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  // Build flat list of all QCM questions from filtered scenarios
  _qcmFiltered = [];
  filtered.forEach(s => {
    const qs = SCENARIO_QCM[s.id] || [];
    qs.forEach((q, qi) => _qcmFiltered.push({ ...q, scenario: s, qIndex: qi }));
  });
  _qcmIndex = 0;
  _qcmScore = { correct: 0, total: 0 };
  _qcmAnswered = false;
  _qcmRender();
  _qcmUpdateProgress();
}

function _qcmRender() {
  const wrapper = document.getElementById('fc-card-wrapper');
  if (!wrapper) return;
  if (!_qcmFiltered.length) {
    wrapper.innerHTML = '<p class="ch-empty" style="padding:60px 0">Aucune question trouvée.</p>';
    return;
  }
  const item = _qcmFiltered[_qcmIndex];
  const s = item.scenario;
  const typeLabel = s.type === 'attack' ? icon('sword',14)+' Attaque' : s.type === 'defense' ? icon('shield',14)+' Défense' : icon('refresh-cw',14)+' Retake';
  const typeClass = s.type === 'attack' ? 'fc-type-attack' : s.type === 'defense' ? 'fc-type-defense' : 'fc-type-retake';
  const rankColor = _fcRankColor(s.rank);

  wrapper.innerHTML = `
    <div class="qcm-card" id="qcm-active-card">
      <div class="qcm-header">
        <span class="fc-rank-pill" style="background:${rankColor}">${s.rank}</span>
        <span class="fc-type-pill ${typeClass}">${typeLabel}</span>
        <span class="qcm-map-pill">${san(s.map)}</span>
      </div>
      <div class="qcm-question">${san(item.q)}</div>
      <div class="qcm-choices" id="qcm-choices">
        ${item.choices.map((c, i) => `
          <button class="qcm-choice" data-idx="${i}" onclick="_qcmAnswer(${i})">
            <span class="qcm-choice-letter">${'ABCD'[i]}</span>
            <span class="qcm-choice-text">${san(c)}</span>
          </button>
        `).join('')}
      </div>
      <div class="qcm-feedback" id="qcm-feedback" style="display:none"></div>
      <div class="qcm-footer" id="qcm-footer" style="display:none">
        <button class="fc-btn fc-btn-train" onclick="_qcmNext()">Suivant →</button>
      </div>
    </div>`;
  _qcmAnswered = false;
}

function _qcmAnswer(chosen) {
  if (_qcmAnswered) return;
  _qcmAnswered = true;
  _qcmScore.total++;
  const item = _qcmFiltered[_qcmIndex];
  const correct = item.answer;
  const isCorrect = chosen === correct;
  if (isCorrect) _qcmScore.correct++;

  // Highlight choices
  const btns = document.querySelectorAll('.qcm-choice');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('qcm-choice--correct');
    if (i === chosen && !isCorrect) btn.classList.add('qcm-choice--wrong');
  });

  // Show feedback
  const fb = document.getElementById('qcm-feedback');
  if (fb) {
    fb.style.display = 'block';
    if (isCorrect) {
      fb.className = 'qcm-feedback qcm-feedback--correct';
      fb.innerHTML = `<span class="qcm-fb-icon">✓</span> Correct !`;
    } else {
      fb.className = 'qcm-feedback qcm-feedback--wrong';
      fb.innerHTML = `<span class="qcm-fb-icon">✕</span> La bonne réponse était : <strong>${san(item.choices[correct])}</strong>`;
    }
  }

  // Show next button (or finish)
  const footer = document.getElementById('qcm-footer');
  if (footer) {
    footer.style.display = 'flex';
    if (_qcmIndex >= _qcmFiltered.length - 1) {
      footer.innerHTML = `<button class="fc-btn fc-btn-train" onclick="_qcmShowResults()">Voir les résultats 🏆</button>`;
    }
  }

  // Mark scenario as completed if all questions for it answered correctly
  if (isCorrect) markScenarioCompleted(item.scenario.id);
  _qcmUpdateProgress();
}

function _qcmNext() {
  if (_qcmIndex < _qcmFiltered.length - 1) {
    _qcmIndex++;
    _qcmRender();
    _qcmUpdateProgress();
  }
}

function _qcmShowResults() {
  const wrapper = document.getElementById('fc-card-wrapper');
  if (!wrapper) return;
  const pct = _qcmScore.total > 0 ? Math.round((_qcmScore.correct / _qcmScore.total) * 100) : 0;
  const grade = pct >= 90 ? { label: 'Excellent !', color: '#2dbe73', emoji: icon('star',20) }
    : pct >= 70 ? { label: 'Bien joué !', color: '#f0c43f', emoji: icon('award',20) }
    : pct >= 50 ? { label: 'Peut mieux faire', color: '#ff8c00', emoji: icon('book',20) }
    : { label: 'À retravailler', color: '#ff4655', emoji: icon('dumbbell',20) };

  wrapper.innerHTML = `
    <div class="qcm-results">
      <div class="qcm-results-emoji">${grade.emoji}</div>
      <h3 class="qcm-results-title" style="color:${grade.color}">${grade.label}</h3>
      <div class="qcm-results-score">
        <span class="qcm-results-pct" style="color:${grade.color}">${pct}%</span>
        <span class="qcm-results-detail">${_qcmScore.correct} / ${_qcmScore.total} bonnes réponses</span>
      </div>
      <div class="qcm-results-bar">
        <div class="qcm-results-bar-fill" style="width:${pct}%;background:${grade.color}"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:24px">
        <button class="fc-btn fc-btn-train" onclick="coachingRenderScenarios()">${icon('refresh-cw',16)} Recommencer</button>
        <button class="fc-btn fc-btn-master" onclick="_qcmOpenModal()">${icon('clipboard',16)} Voir les guides</button>
      </div>
    </div>`;
}

function _qcmOpenModal() {
  // Open the scenario modal for study
  if (_qcmFiltered.length && typeof coachingOpenScenarioModal === 'function') {
    coachingOpenScenarioModal(_qcmFiltered[_qcmIndex]?.scenario || _qcmFiltered[0].scenario);
  }
}

function _qcmNav(dir) {
  if (!_qcmFiltered.length) return;
  const next = _qcmIndex + dir;
  if (next < 0 || next >= _qcmFiltered.length) return;
  _qcmIndex = next;
  _qcmAnswered = false;
  _qcmRender();
  _qcmUpdateProgress();
}

function _qcmUpdateProgress() {
  const counter = document.getElementById('fc-counter');
  const masteredEl = document.getElementById('fc-mastered-count');
  if (counter) counter.textContent = _qcmFiltered.length ? `Question ${_qcmIndex + 1} / ${_qcmFiltered.length}` : '0 / 0';
  if (masteredEl) {
    const pct = _qcmScore.total > 0 ? Math.round((_qcmScore.correct / _qcmScore.total) * 100) : 0;
    masteredEl.textContent = _qcmScore.total > 0 ? `${_qcmScore.correct}/${_qcmScore.total} (${pct}%)` : 'Pas encore répondu';
  }
}

function _fcRankColor(rank) {
  const colors = { IRON:'#8b8b8b', BRONZE:'#cd7f32', SILVER:'#c0c0c0', GOLD:'#ffd700', PLATINUM:'#00bfa5', DIAMOND:'#b388ff', ASCENDANT:'#2dbe73', IMMORTAL:'#ff4655', RADIANT:'#fffacd' };
  return colors[rank] || 'var(--dim)';
}

// Keyboard navigation for QCM
document.addEventListener('keydown', (e) => {
  const scenPanel = document.getElementById('ch-scenarios');
  if (!scenPanel || scenPanel.style.display === 'none' || !scenPanel.offsetParent) return;
  if (e.key === 'ArrowRight' && _qcmAnswered) { e.preventDefault(); _qcmNext(); }
  if (['1','2','3','4','a','b','c','d'].includes(e.key.toLowerCase()) && !_qcmAnswered) {
    const map = { '1':0,'a':0, '2':1,'b':1, '3':2,'c':2, '4':3,'d':3 };
    const idx = map[e.key.toLowerCase()];
    if (idx !== undefined && idx < (_qcmFiltered[_qcmIndex]?.choices.length || 0)) {
      e.preventDefault(); _qcmAnswer(idx);
    }
  }
});

// Nav button listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fc-prev')?.addEventListener('click', () => _qcmNav(-1));
  document.getElementById('fc-next')?.addEventListener('click', () => _qcmNav(1));
});

function coachingOpenScenarioModal(s) {
  const modal = document.getElementById('ch-scenario-modal');
  if (!modal) return;
  document.getElementById('ch-sm-title').textContent = s.title;
  document.getElementById('ch-sm-badge').textContent = s.rank || '';
  document.getElementById('ch-sm-meta').textContent = `${s.map || ''} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'defense' ? 'Défense' : 'Retake'} \u00b7 Difficulte ${s.difficulty || 3}/5`;
  document.getElementById('ch-sm-guide').textContent = s.guide || 'Guide non disponible.';
  document.getElementById('ch-sm-tips').textContent = s.tips || '';
  // Render blank map or custom annotations if available
  if (typeof renderTacticalMap === 'function' && (getCustomScenarioMap(s.id) || typeof SCENARIO_ANNOTATIONS !== 'undefined' && SCENARIO_ANNOTATIONS[s.id])) {
    renderTacticalMap('ch-sm-map', s.id, 0);
  } else if (typeof renderBlankMap === 'function' && s.map) {
    renderBlankMap('ch-sm-map', s.map);
  }

  const trainBtn = document.getElementById('ch-sm-train-btn');
  const aimMode = s.aim_mode || s.aimMode;
  const aimDiff = s.aim_diff || s.aimDiff;
  trainBtn.textContent = aimMode ? `S'entrainer (${aimMode.replace('_',' ')})` : "S'entrainer";
  trainBtn.onclick = () => {
    coachingCloseScenarioModal();
    markScenarioCompleted(s.id);
    incrementSessions();
    _setCoachLaunchSource('ch-scenarios');
    
    coachingSwitchTab('hub-home');
    if (aimDiff) document.getElementById('opt-diff').value = aimDiff;
    setTimeout(() => { const btn = document.querySelector(`.mode-card[data-mode="${aimMode}"]`); if (btn) btn.click(); }, 100);
  };

  const completeBtn = document.getElementById('ch-sm-complete-btn');
  const done = getCompletedscenarios().includes(s.id);
  completeBtn.textContent = done ? 'Deja complete' : 'Marquer comme complete';
  completeBtn.disabled = done;
  completeBtn.onclick = () => { markScenarioCompleted(s.id); completeBtn.textContent = 'Deja complete'; completeBtn.disabled = true; };

  // Edit map button -> opens Map Editor with scénario data
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

  const isStaff = coachingUserRole === 'admin' || coachingUserRole === 'coach';
  const customs = getCustomAgents();

  filtered.forEach(a => {
    const ag = getAgent(a);
    const hasCustom = !!customs[a.name];
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="ch-card-title" style="margin:0">${ag.name}</div>
        ${isStaff ? `<div style="display:flex;gap:4px">
          ${hasCustom ? '<button class="ag-reset" style="padding:4px 8px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--dim);border-radius:4px;cursor:pointer;font-size:0.6rem;font-family:var(--font)">Reset</button>' : ''}
          <button class="ag-edit" style="padding:4px 10px;background:var(--red-g);border:1px solid var(--accent);color:var(--accent);border-radius:4px;cursor:pointer;font-size:0.65rem;font-weight:600;font-family:var(--font)">Editer</button>
        </div>` : ''}
      </div>
      <span class="ch-badge">${ag.role}</span>
      <p class="ch-card-desc" style="font-style:italic;margin-top:10px">${ag.summary}</p>
      <div class="ch-howto"><strong>Comment jouer :</strong><br>${ag.howToPlay}</div>
    `;

    if (isStaff) {
      card.querySelector('.ag-edit')?.addEventListener('click', () => openAgentEditModal(a));
      card.querySelector('.ag-reset')?.addEventListener('click', () => {
        if (confirm(`Revenir a la description par defaut de ${a.name} ?`)) {
          deleteCustomAgent(a.name);
          coachingRenderAgents();
        }
      });
    }

    list.appendChild(card);
  });
}

function openAgentEditModal(agent) {
  const ag = getAgent(agent);
  const modal = document.getElementById('ch-agent-edit-modal');
  if (!modal) return;
  document.getElementById('ch-ae-name').textContent = ag.name;
  document.getElementById('ch-ae-summary').value = ag.summary;
  document.getElementById('ch-ae-howto').value = ag.howToPlay;
  document.getElementById('ch-ae-save').onclick = () => {
    saveCustomAgent(agent.name, {
      summary: document.getElementById('ch-ae-summary').value,
      howToPlay: document.getElementById('ch-ae-howto').value,
    });
    modal.classList.remove('active');
    coachingRenderAgents();
  };
  modal.classList.add('active');
}

// Close agent modal on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ch-agent-edit-modal')?.addEventListener('click', e => {
    if (e.target.id === 'ch-agent-edit-modal') e.target.classList.remove('active');
  });
});

// ============ VODS ============

function getWatchedVods() {
  try { return JSON.parse(localStorage.getItem('valAim_watchedVods') || '[]'); } catch { return []; }
}
function markVodWatched(id) {
  const list = getWatchedVods();
  if (!list.includes(id)) { list.push(id); localStorage.setItem('valAim_watchedVods', JSON.stringify(list)); }
}

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

// ============ DAILY TRAINING ============

const _DT_CAT_LABELS = {
  control_tracking:'Control Tracking', reactive_tracking:'Reactive Tracking',
  flick_tech:'Flick Tech', click_timing:'Click Timing'
};
const _DT_TIER_COLOR = { easier:'#4ade80', medium:'#60a5fa', hard:'#f87171' };

function dailyTrainingLoad() {
  const el = document.getElementById('dt-content');
  if (!el) return;

  const vd = window._viscData;
  if (!vd) {
    el.innerHTML = '<p class="ch-empty">Chargement des données…</p>';
    setTimeout(dailyTrainingLoad, 300);
    return;
  }

  // All benchmark scenarios (th defined)
  const allKeys = Object.keys(vd.SCENARIOS).filter(k => vd.SCENARIOS[k].th);
  if (!allKeys.length) { el.innerHTML = '<p class="ch-empty">Aucun scénario disponible.</p>'; return; }

  // Date-seeded daily rotation — 5 unique picks
  const d = new Date();
  const dayNum = Math.floor(d / 86400000); // days since epoch
  const picks = [];
  const used = new Set();
  for (let i = 0; picks.length < 5 && i < allKeys.length * 2; i++) {
    const key = allKeys[(dayNum * 7 + i * 3 + 13) % allKeys.length];
    if (!used.has(key)) { used.add(key); picks.push(key); }
  }

  const dateStr = d.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  el.innerHTML = `
    <h2 class="ch-section-title">${icon('calendar',18)} Daily Training</h2>
    <div class="dt-date">${dateStr}</div>
    <p class="dt-desc">5 exercices du jour — complète les threads du tier recommandé pour progresser&nbsp;!</p>
    <div class="dt-list">
      ${picks.map(key => {
        const sc = vd.SCENARIOS[key];

        // Recommended tier: follow Viscose progression logic
        // Move to next tier only when current tier is fully maxed (8/8 or 6/6)
        const eT  = vd.calcThreadsFor(key, vd.getBestFor(key,'easier'), 'easier');
        const eMt = vd.maxThreadsFor('easier'); // 8
        const mT  = vd.calcThreadsFor(key, vd.getBestFor(key,'medium'), 'medium');
        const mMt = vd.maxThreadsFor('medium'); // 8
        let recTier = 'easier';
        if (eT >= eMt) recTier = 'medium';
        if (eT >= eMt && mT >= mMt) recTier = 'hard';

        // If the recommended tier is locked (shouldn't normally happen given above logic,
        // but guard against edge cases like missing thH/thE), fallback
        if (!vd.isScenarioUnlocked(key, recTier)) recTier = 'easier';

        const best    = vd.getBestFor(key, recTier);
        const threads = vd.calcThreadsFor(key, best, recTier);
        const mt      = vd.maxThreadsFor(recTier);
        const pct     = Math.min(100, threads / mt * 100);
        const color   = _DT_TIER_COLOR[recTier];
        const tierLbl = recTier === 'easier' ? 'Easier' : recTier === 'medium' ? 'Medium' : 'Hard';
        const label   = recTier === 'easier' ? (sc.labelE || sc.label)
                      : recTier === 'hard'   ? (sc.labelH || sc.label) : sc.label;
        const cat = _DT_CAT_LABELS[sc.cat] || sc.cat;

        // Lock check: Medium/Hard need at least 1 thread on prev tier
        const locked = !vd.isScenarioUnlocked(key, recTier);
        const prevTierLbl = recTier === 'hard' ? 'Medium' : 'Easier';
        const launchBtn = locked
          ? `<span class="dt-locked-badge" title="Faire au moins 1 session en ${prevTierLbl} pour débloquer">${icon('lock',14)} Verrouillé</span>`
          : `<button class="dt-launch-btn" onclick="dtLaunch('${key}','${recTier}')">▶ Lancer</button>`;

        return `<div class="dt-exercise${locked?' dt-exercise-locked':''}">
          <div class="dt-ex-header">
            <div class="dt-ex-name">${san(label)}</div>
            <span class="dt-ex-tier" style="color:${color};border-color:${color}40;background:${color}15">${tierLbl}</span>
          </div>
          <div class="dt-ex-cat">${cat}</div>
          <div class="dt-ex-progress">
            <div class="dt-ex-bar"><div class="dt-ex-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="dt-ex-threads">${threads}/${mt}</span>
          </div>
          ${launchBtn}
        </div>`;
      }).join('')}
    </div>`;
}

function dtLaunch(key, tier) {
  const vd = window._viscData;
  if (vd) vd.setTier(tier);
  window._coachLaunchSource = { tab: 'ch-daily-training' };
  // NE PAS passer par .mode-card.click() — ce listener force G.benchmarkMode=false
  // On appelle startGame directement avec benchmarkMode=true déjà positionné
  if (window._G) window._G.benchmarkMode = true;
  if (typeof startGame === 'function') startGame(key);
}

const WARMUP_ROUTINES = [
  {
    id: 'debutant', name: icon('sprout',16)+' Débutant', desc: '3 exercices · 45s chacun · Tracking + Précision',
    exercises: [
      { mode: 'ground_plaza', diff: 'easy',   dur: 45, label: 'Ground Plaza — Tracking sol' },
      { mode: 'pasu_reload',  diff: 'easy',   dur: 45, label: 'Pasu Reload — Clics précis' },
      { mode: 'air_pure',     diff: 'easy',   dur: 45, label: 'Air Pure — Tracking aérien' }
    ]
  },
  {
    id: 'intermediaire', name: icon('zap',16)+' Intermédiaire', desc: '4 exercices · 60s chacun · Mix complet',
    exercises: [
      { mode: 'ground_plaza',    diff: 'medium', dur: 60, label: 'Ground Plaza — Tracking sol' },
      { mode: 'pasu_reload',     diff: 'medium', dur: 60, label: 'Pasu Reload — Clics précis' },
      { mode: 'flicker_plaza',   diff: 'medium', dur: 60, label: 'Flicker Plaza — Réactivité' },
      { mode: 'pokeball_frenzy', diff: 'medium', dur: 60, label: 'Pokeball Frenzy — Vitesse' }
    ]
  },
  {
    id: 'avance', name: icon('flame',16)+' Avancé', desc: '5 exercices · 60s chacun · Intensif',
    exercises: [
      { mode: 'ground_plaza',    diff: 'hard', dur: 60, label: 'Ground Plaza — Tracking sol' },
      { mode: 'pasu_angelic',    diff: 'hard', dur: 60, label: 'Pasu Angelic — Micro précision' },
      { mode: 'flicker_plaza',   diff: 'hard', dur: 60, label: 'Flicker Plaza — Réactivité' },
      { mode: 'vox_ts2',         diff: 'hard', dur: 60, label: 'voxTS2 — Target Switch' },
      { mode: 'air_voltaic',     diff: 'hard', dur: 60, label: 'Air Voltaic — Tracking aérien' }
    ]
  }
];

function _launchRoutineExercise(routine, idx) {
  if (idx >= routine.exercises.length) return;
  const ex = routine.exercises[idx];
  window._coachLaunchSource = { tab: 'ch-warmup', routine, routineIdx: idx };
  
  coachingSwitchTab('hub-home');
  if (ex.dur) {
    const durEl = document.getElementById('opt-duration');
    if (durEl) durEl.value = ex.dur;
  }
  if (ex.diff) {
    const diffEl = document.getElementById('opt-diff');
    if (diffEl) diffEl.value = ex.diff;
  }
  setTimeout(() => {
    const modeBtn = document.querySelector(`.mode-card[data-mode="${ex.mode}"]`);
    if (modeBtn) modeBtn.click();
    else if (typeof startGame === 'function') startGame(ex.mode);
  }, 100);
}

function _renderRoutineCards() {
  const el = document.getElementById('wu-routine-wrap');
  if (!el) return;
  el.innerHTML = WARMUP_ROUTINES.map(r => `
    <div class="wu-routine-card">
      <div class="wu-routine-name">${r.name}</div>
      <div class="wu-routine-desc">${r.desc}</div>
      <ol class="wu-routine-steps">
        ${r.exercises.map(e => `<li>${san(e.label)}</li>`).join('')}
      </ol>
      <button class="btn-primary wu-routine-btn" style="width:100%;margin-top:12px" onclick="_launchRoutineExercise(WARMUP_ROUTINES.find(x=>x.id==='${r.id}'),0)">
        ▶ Démarrer la routine
      </button>
    </div>`).join('');
}

function initWarmupPanel() {
  const panel = document.getElementById('ch-warmup');
  if (!panel) return;

  _renderRoutineCards();

  // ── Exercise buttons individuels ──────────────────────────────────────
  panel.querySelectorAll('.warmup-exercise-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const diff = btn.dataset.diff;
      _setCoachLaunchSource('ch-warmup');
      const _diffEl = document.getElementById('opt-diff');
      if (_diffEl) _diffEl.value = diff;
      setTimeout(() => {
        const modeBtn = document.querySelector(`.mode-card[data-mode="${mode}"]`);
        if (modeBtn) modeBtn.click();
        else if (typeof startGame === 'function') startGame(mode);
      }, 100);
    });
  });

  // ── Eyes Tracker (zig-zag canvas) ────────────────────────────────────
  const canvas   = document.getElementById('wu-eye-canvas');
  const startBtn = document.getElementById('wu-eye-start');
  const timerEl  = document.getElementById('wu-eye-timer');
  const speedSel = document.getElementById('wu-eye-speed');

  if (canvas && startBtn && !startBtn.dataset.bound) {
    startBtn.dataset.bound = '1';
    const ctx = canvas.getContext('2d');
    let animId = null, animStart = null, sessionStart = null, running = false;
    const SESSION_MS = 30000;

    // Zig-zag waypoints [x%, y%] — left→right then right→left loop
    const WP = [
      [0,50],[14,10],[28,90],[42,10],[56,90],[70,10],[84,90],[100,50],
      [86,10],[72,90],[58,10],[44,90],[30,10],[16,90],[0,50]
    ];
    const SPEEDS = { slow: 9000, medium: 5500, fast: 3000 };

    function lerp(a, b, t) { return a + (b - a) * t; }
    function getPos(t) {
      const n = WP.length - 1;
      const seg = t * n;
      const i = Math.min(Math.floor(seg), n - 1);
      const f = seg - i;
      return { x: lerp(WP[i][0], WP[i+1][0], f), y: lerp(WP[i][1], WP[i+1][1], f) };
    }

    function draw(ts) {
      if (!animStart)   animStart   = ts;
      if (!sessionStart) sessionStart = ts;

      const cycleMs   = SPEEDS[speedSel?.value || 'medium'];
      const t         = ((ts - animStart) % cycleMs) / cycleMs;
      const remaining = Math.max(0, SESSION_MS - (ts - sessionStart));

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Dashed guide path
      ctx.save();
      ctx.strokeStyle = 'rgba(255,70,85,0.14)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      WP.forEach(([wx, wy], i) => {
        i === 0 ? ctx.moveTo(wx/100*W, wy/100*H) : ctx.lineTo(wx/100*W, wy/100*H);
      });
      ctx.stroke();
      ctx.restore();

      // Waypoint dots
      WP.forEach(([wx, wy]) => {
        ctx.beginPath();
        ctx.arc(wx/100*W, wy/100*H, 2.5, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,70,85,0.22)';
        ctx.fill();
      });

      // Ball
      const pos = getPos(t);
      const bx = pos.x/100*W, by = pos.y/100*H;

      // Glow
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 24);
      grad.addColorStop(0, 'rgba(255,70,85,0.4)');
      grad.addColorStop(1, 'rgba(255,70,85,0)');
      ctx.beginPath(); ctx.arc(bx, by, 24, 0, Math.PI*2);
      ctx.fillStyle = grad; ctx.fill();

      // Core
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2);
      ctx.fillStyle = '#ff4655'; ctx.fill();

      // Highlight
      ctx.beginPath(); ctx.arc(bx-2.5, by-2.5, 3.5, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();

      // Timer
      const secs = Math.ceil(remaining / 1000);
      if (timerEl) timerEl.textContent = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;

      if (remaining <= 0) { stopEye(); return; }
      animId = requestAnimationFrame(draw);
    }

    function startEye() {
      running = true;
      animStart = sessionStart = null;
      canvas.width  = canvas.offsetWidth  || 700;
      canvas.height = 150;
      startBtn.textContent = '⏹ Stop';
      animId = requestAnimationFrame(draw);
    }
    function stopEye() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      startBtn.textContent = '▶ Démarrer';
      if (timerEl) timerEl.textContent = '0:30';
    }
    startBtn.addEventListener('click', () => running ? stopEye() : startEye());
  }

  // ── Timer buttons (20-20-20 / palming) ─────────────────────────────────
  ['wu-far-btn', 'wu-palm-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const dur = parseInt(btn.dataset.dur);
      let t = dur;
      btn.disabled = true;
      btn.textContent = t + ' s…';
      const iv = setInterval(() => {
        t--;
        btn.textContent = t > 0 ? t + ' s…' : '✓ Fait';
        if (t <= 0) {
          clearInterval(iv);
          btn.disabled = false;
          btn.classList.add('wu-done');
        }
      }, 1000);
    });
  });

  // ── Saccades ────────────────────────────────────────────────────────────
  const saccBtn = document.getElementById('wu-sacc-btn');
  const saccBox = document.getElementById('wu-saccade-box');
  const saccStatus = document.getElementById('wu-sacc-status');
  if (saccBtn && saccBox && !saccBtn.dataset.bound) {
    saccBtn.dataset.bound = '1';
    // Corner positions [top%, left%] for the 4 dots
    const CORNERS = [
      { top: '15%', left: '10%' }, { top: '15%', right: '10%' },
      { bottom: '15%', right: '10%' }, { bottom: '15%', left: '10%' }
    ];
    const dots = [0,1,2,3].map(i => {
      const el = document.getElementById('wu-sacc-' + i);
      if (el) { Object.assign(el.style, CORNERS[i]); }
      return el;
    });
    const SEQUENCES = [[0,2,1,3],[3,1,2,0],[0,3,1,2]]; // 3 series
    saccBtn.addEventListener('click', () => {
      if (saccBtn.disabled) return;
      saccBtn.disabled = true;
      saccBtn.textContent = '…';
      dots.forEach(d => d && d.classList.remove('active'));
      let s = 0, step = 0;
      function next() {
        if (s >= SEQUENCES.length) {
          dots.forEach(d => d && d.classList.remove('active'));
          saccStatus.textContent = '✓ Terminé !';
          saccBtn.textContent = '✓ Fait';
          saccBtn.classList.add('wu-done');
          saccBtn.disabled = false;
          return;
        }
        const seq = SEQUENCES[s];
        const idx = seq[step];
        dots.forEach(d => d && d.classList.remove('active'));
        dots[idx] && dots[idx].classList.add('active');
        saccStatus.textContent = `Série ${s+1}/3 — point ${step+1}/4`;
        step++;
        if (step >= seq.length) { s++; step = 0; }
        setTimeout(next, 750);
      }
      next();
    });
  }

  // ── Box Breathing (avec comptage de cycles) ──────────────────────────────
  const breathBtn    = document.getElementById('wu-breath-start');
  const breathCircle = document.getElementById('wu-breath-circle');
  const breathText   = document.getElementById('wu-breath-text');
  const breathCycles = document.getElementById('wu-breath-cycles');

  if (breathBtn && !breathBtn.dataset.bound) {
    breathBtn.dataset.bound = '1';
    let timer = null, breathRunning = false, phaseIdx = 0, cycleCount = 0;
    const TOTAL_CYCLES = 4;

    const PHASES = [
      { text: 'Inspire',  scale: 1.45, color: '#60a5fa', dur: 4000 },
      { text: 'Retiens',  scale: 1.45, color: '#e8c56d', dur: 4000 },
      { text: 'Expire',   scale: 1.0,  color: '#4ade80', dur: 4000 },
      { text: 'Retiens',  scale: 1.0,  color: '#a78bfa', dur: 4000 },
    ];

    function runPhase(idx) {
      if (!breathRunning) return;
      if (idx === 0 && cycleCount > 0 && breathCycles)
        breathCycles.textContent = cycleCount + ' / ' + TOTAL_CYCLES + ' cycles';
      if (cycleCount >= TOTAL_CYCLES) { stopBreath(true); return; }
      const p = PHASES[idx];
      breathText.textContent         = p.text;
      breathCircle.style.transform   = `scale(${p.scale})`;
      breathCircle.style.borderColor = p.color;
      breathText.style.color         = p.color;
      timer = setTimeout(() => {
        const next = (idx + 1) % PHASES.length;
        if (next === 0) cycleCount++;
        runPhase(next);
      }, p.dur);
    }
    function startBreath() {
      breathRunning = true; cycleCount = 0; phaseIdx = 0;
      if (breathCycles) breathCycles.textContent = '0 / ' + TOTAL_CYCLES + ' cycles';
      breathBtn.textContent = '⏹ Stop';
      runPhase(0);
    }
    function stopBreath(done) {
      breathRunning = false;
      clearTimeout(timer);
      if (done) {
        breathBtn.textContent = '✓ Fait';
        breathBtn.classList.add('wu-done');
        if (breathCycles) breathCycles.textContent = TOTAL_CYCLES + ' / ' + TOTAL_CYCLES + ' cycles ✓';
        breathCircle.style.borderColor = '#4ade80';
        breathText.textContent = '✓';
        breathText.style.color = '#4ade80';
      } else {
        breathBtn.textContent          = '▶ Box Breathing';
        breathCircle.style.transform   = 'scale(1)';
        breathCircle.style.borderColor = 'var(--accent)';
        breathText.textContent         = 'Inspire';
        breathText.style.color         = 'var(--txt)';
        if (breathCycles) breathCycles.textContent = '0 / ' + TOTAL_CYCLES + ' cycles';
      }
    }
    breathBtn.addEventListener('click', () => breathRunning ? stopBreath(false) : startBreath());
  }

  // ── Intention du jour ────────────────────────────────────────────────────
  (function() {
    const ta = document.getElementById('wu-intention');
    const prev = document.getElementById('wu-prev-intention');
    if (!ta) return;
    try {
      const saved = JSON.parse(localStorage.getItem('wu_intention'));
      if (!saved) return;
      const today = new Date().toLocaleDateString('fr-FR');
      if (saved.date === today) {
        ta.value = saved.text;
      } else if (saved.text && prev) {
        prev.textContent = `Hier : « ${saved.text.slice(0,60)}${saved.text.length>60?'…':''} »`;
      }
    } catch {}
  })();

  // ── Anti-tilt reminders ──────────────────────────────────────────────────
  wuRenderTiltList();
  const tiltInput = document.getElementById('wu-tilt-input');
  if (tiltInput && !tiltInput.dataset.bound) {
    tiltInput.dataset.bound = '1';
    tiltInput.addEventListener('keydown', e => { if (e.key === 'Enter') wuAddTiltReminder(); });
  }
}

function wuSaveIntention() {
  const ta = document.getElementById('wu-intention');
  const ok = document.getElementById('wu-intention-ok');
  if (!ta || !ta.value.trim()) return;
  localStorage.setItem('wu_intention', JSON.stringify({
    date: new Date().toLocaleDateString('fr-FR'), text: ta.value.trim()
  }));
  if (ok) { ok.style.display = ''; setTimeout(() => ok.style.display = 'none', 2000); }
}

function wuGetTiltReminders() {
  try { return JSON.parse(localStorage.getItem('wu_tilt_reminders')) || []; } catch { return []; }
}
function wuSaveTiltReminders(list) {
  localStorage.setItem('wu_tilt_reminders', JSON.stringify(list));
}
function wuRenderTiltList() {
  const el = document.getElementById('wu-tilt-list');
  if (!el) return;
  const list = wuGetTiltReminders();
  if (!list.length) {
    el.innerHTML = '<div class="wu-tilt-empty">Aucun rappel — ajoute ce que tu veux te dire quand tu tilt.</div>';
    return;
  }
  el.innerHTML = list.map((r, i) => `
    <div class="wu-tilt-item">
      <span class="wu-tilt-bullet">→</span>
      <span class="wu-tilt-text">${san(r)}</span>
      <button class="wu-tilt-del" onclick="wuDeleteTiltReminder(${i})" title="Supprimer">×</button>
    </div>`).join('');
}
function wuAddTiltReminder() {
  const inp = document.getElementById('wu-tilt-input');
  if (!inp || !inp.value.trim()) return;
  const list = wuGetTiltReminders();
  list.push(inp.value.trim());
  wuSaveTiltReminders(list);
  inp.value = '';
  wuRenderTiltList();
}
function wuDeleteTiltReminder(idx) {
  const list = wuGetTiltReminders();
  list.splice(idx, 1);
  wuSaveTiltReminders(list);
  wuRenderTiltList();
}

// ============ ADMIN: STUDENTS ============

// ============ ADMIN PANEL ============

let _adminUsers = [];
let _adminRelations = [];
let _adminRelFilter = 'active';

async function adminLoad() {
  const searchEl = document.getElementById('admin-user-search');
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', adminRenderUsers);
  }
  document.querySelectorAll('.admin-filter-btn').forEach(b => {
    if (!b.dataset.bound) {
      b.dataset.bound = '1';
      b.addEventListener('click', () => adminSetRelFilter(b.dataset.rfilter));
    }
  });
  adminLoadStats();
  adminLoadUsers();
  adminLoadRelations();
  adminLoadAllAnnouncements();
  adminLoadAuditLogs();
}

async function adminLoadStats() {
  try {
    const res = await fetch(`${API_BASE}/coaching?view=admin-stats`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) return;
    const d = await res.json();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };
    set('astat-total', d.total_users);
    set('astat-students', d.students);
    set('astat-coaches', d.coaches);
    set('astat-sessions', d.sessions);
    set('astat-relations', d.active_relations);
    set('astat-locked', d.locked);
    set('astat-mfa', d.mfa_enabled);
    set('astat-top-score', d.top_score ? d.top_score.toLocaleString() : '—');
  } catch {}
}

async function adminLoadUsers() {
  const el = document.getElementById('admin-users-table');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement…</p>';
  try {
    const res = await fetch(`${API_BASE}/coaching?view=all-users`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    const d = await res.json();
    _adminUsers = d.users || [];
    adminRenderUsers();
  } catch { el.innerHTML = '<p class="ch-empty">Erreur de chargement.</p>'; }
}

function adminRenderUsers() {
  const el = document.getElementById('admin-users-table');
  if (!el) return;
  const q = (document.getElementById('admin-user-search')?.value || '').toLowerCase();
  const users = q ? _adminUsers.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : _adminUsers;
  if (!users.length) { el.innerHTML = '<p class="ch-empty">Aucun utilisateur.</p>'; return; }
  const roleLabel = { admin: 'Admin', coach: 'Coach', student: 'Élève' };
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Pseudo</th><th>Email</th><th>Rôle</th><th>Rang</th><th>MFA</th><th>Verrou</th><th>Inscrit</th><th>Actions</th></tr></thead>
    <tbody>${users.map(u => {
      const locked = u.locked_until && new Date(u.locked_until) > new Date();
      return `<tr>
        <td><strong>${san(u.username)}</strong></td>
        <td style="color:var(--dim);font-size:0.78rem">${san(u.email)}</td>
        <td><span class="admin-badge role-${u.role}">${roleLabel[u.role] || san(u.role)}</span></td>
        <td>${u.current_rank ? rankBadge(u.current_rank) : '<span style="color:var(--dim)">—</span>'}</td>
        <td>${u.mfa_enabled ? '<span class="admin-badge admin-mfa-badge">MFA</span>' : '<span style="color:var(--dim)">—</span>'}</td>
        <td>${locked ? '<span class="admin-badge admin-locked-badge">'+icon('lock',14)+'</span>' : '<span style="color:#4ade80">✓</span>'}</td>
        <td style="color:var(--dim);font-size:0.75rem">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
        <td><div class="admin-actions">
          <select class="admin-btn admin-btn-role" onchange="adminChangeRole(${u.id}, this.value)">
            <option value="student"${u.role==='student'?' selected':''}>Élève</option>
            <option value="coach"${u.role==='coach'?' selected':''}>Coach</option>
            <option value="admin"${u.role==='admin'?' selected':''}>Admin</option>
          </select>
          ${locked
            ? `<button class="admin-btn admin-btn-unlock" onclick="adminUnlockUser(${u.id})" title="Déverrouiller">${icon('unlock',14)}</button>`
            : `<button class="admin-btn admin-btn-lock" onclick="adminLockUser(${u.id},'${san(u.username)}')" title="Verrouiller">${icon('lock',14)}</button>`}
          ${u.mfa_enabled ? `<button class="admin-btn admin-btn-mfa" onclick="adminResetMfa(${u.id})" title="Reset MFA">${icon('key',14)}</button>` : ''}
          <button class="admin-btn admin-btn-del" onclick="adminDeleteUser(${u.id},'${san(u.username)}')" title="Supprimer">${icon('trash',14)}</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function adminChangeRole(userId, role) {
  try {
    const res = await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ userId, role })
    });
    if (!res.ok) { const d = await res.json(); alert('Erreur: ' + d.error); return; }
    const u = _adminUsers.find(x => x.id === userId);
    if (u) u.role = role;
    adminRenderUsers();
    adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function adminLockUser(userId, username) {
  const input = prompt(`Verrouiller "${username}" pour combien de minutes ?\n(laisser vide = permanent)`);
  if (input === null) return; // annulé
  const minutes = parseInt(input) || null;
  try {
    await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'lock', userId, minutes })
    });
    adminLoadUsers(); adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function adminUnlockUser(userId) {
  try {
    await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'unlock', userId })
    });
    adminLoadUsers(); adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function adminResetMfa(userId) {
  if (!confirm('Réinitialiser le MFA de cet utilisateur ?')) return;
  try {
    await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'reset-mfa', userId })
    });
    adminLoadUsers(); adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function adminDeleteUser(userId, username) {
  if (!confirm(`Supprimer le compte de "${username}" ? Irréversible.`)) return;
  try {
    const res = await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'delete', userId })
    });
    const d = await res.json();
    if (d.error) { alert('Erreur: ' + d.error); return; }
    adminLoadUsers(); adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function adminLoadRelations() {
  const el = document.getElementById('admin-relations-table');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement…</p>';
  try {
    const res = await fetch(`${API_BASE}/coaching?view=all-relationships`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    const d = await res.json();
    _adminRelations = d.relationships || [];
    adminRenderRelations();
  } catch { el.innerHTML = '<p class="ch-empty">Erreur.</p>'; }
}

function adminSetRelFilter(f) {
  _adminRelFilter = f;
  document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.rfilter === f));
  adminRenderRelations();
}

function adminRenderRelations() {
  const el = document.getElementById('admin-relations-table');
  if (!el) return;
  const rels = _adminRelFilter === 'all' ? _adminRelations : _adminRelations.filter(r => r.status === _adminRelFilter);
  if (!rels.length) { el.innerHTML = '<p class="ch-empty">Aucune relation.</p>'; return; }
  const statusBadge = {
    active:  '<span style="color:#4ade80">Actif</span>',
    pending: '<span style="color:#fbbf24">En attente</span>',
    ended:   '<span style="color:var(--dim)">Terminé</span>',
    declined:'<span style="color:#f87171">Refusé</span>'
  };
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Coach</th><th>Joueur</th><th>Statut</th><th>Créée le</th><th>Action</th></tr></thead>
    <tbody>${rels.map(r => `<tr>
      <td><strong>${san(r.coach_username)}</strong> <span style="font-size:0.72rem;color:var(--dim)">(${san(r.coach_role)})</span></td>
      <td>${san(r.player_username)}</td>
      <td>${statusBadge[r.status] || san(r.status)}</td>
      <td style="color:var(--dim);font-size:0.75rem">${new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
      <td><button class="admin-btn admin-btn-del" onclick="adminDeleteRelation(${r.rel_id})">${icon('trash',14)} Supprimer</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── Annonces admin ──────────────────────────────────────────────────────────

async function adminLoadAllAnnouncements() {
  const el = document.getElementById('admin-announcements-list');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement…</p>';
  try {
    const res = await fetch(`${API_BASE}/coaching?view=all-announcements`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    const d = await res.json();
    adminRenderAllAnnouncements(d.announcements || []);
  } catch {}
}

function adminRenderAllAnnouncements(list) {
  const el = document.getElementById('admin-announcements-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<p class="ch-empty">Aucune annonce.</p>'; return; }
  const typeColors = { info:'#60a5fa', warning:'#fbbf24', success:'#4ade80', danger:'#ff4655' };
  el.innerHTML = list.map(a => {
    const c = typeColors[a.type] || '#888';
    return `<div class="admin-ann-row">
      <div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="admin-badge" style="background:${c}22;color:${c}">${a.type}</span>
        <strong>${san(a.title)}</strong>
        <span style="color:var(--dim);font-size:0.78rem">${san(a.content)}</span>
        ${a.expires_at ? `<span style="font-size:0.72rem;color:var(--dim)">exp. ${new Date(a.expires_at).toLocaleDateString('fr-FR')}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <span style="font-size:0.75rem;color:${a.active?'#4ade80':'var(--dim)'}">${a.active?'● Actif':'○ Inactif'}</span>
        <button class="admin-btn admin-btn-role" onclick="adminToggleAnnouncement(${a.id})">${a.active?'Désactiver':'Activer'}</button>
        <button class="admin-btn admin-btn-del" onclick="adminDeleteAnnouncement(${a.id})">${icon('trash',14)}</button>
      </div>
    </div>`;
  }).join('');
}

async function adminCreateAnnouncement() {
  const title   = document.getElementById('ann-title')?.value.trim();
  const content = document.getElementById('ann-content')?.value.trim();
  const type    = document.getElementById('ann-type')?.value || 'info';
  const expires = document.getElementById('ann-expires')?.value || null;
  if (!title || !content) { alert('Titre et contenu requis'); return; }
  try {
    const res = await fetch(`${API_BASE}/coaching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'create-announcement', title, content, type, expires_at: expires || null })
    });
    if (!res.ok) { const d = await res.json(); alert('Erreur: ' + d.error); return; }
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-content').value = '';
    adminLoadAllAnnouncements();
    loadAnnouncements();
  } catch { alert('Erreur réseau'); }
}

async function adminToggleAnnouncement(id) {
  try {
    await fetch(`${API_BASE}/coaching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'toggle-announcement', ann_id: id })
    });
    adminLoadAllAnnouncements(); loadAnnouncements();
  } catch {}
}

async function adminDeleteAnnouncement(id) {
  if (!confirm('Supprimer cette annonce ?')) return;
  try {
    await fetch(`${API_BASE}/coaching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'delete-announcement', ann_id: id })
    });
    adminLoadAllAnnouncements(); loadAnnouncements();
  } catch {}
}

// ── Audit logs ──────────────────────────────────────────────────────────────

async function adminLoadAuditLogs() {
  const el = document.getElementById('admin-audit-table');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement…</p>';
  try {
    const res = await fetch(`${API_BASE}/coaching?view=audit-logs`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    const d = await res.json();
    adminRenderAuditLogs(d.logs || []);
  } catch { el.innerHTML = '<p class="ch-empty">Erreur.</p>'; }
}

function adminRenderAuditLogs(logs) {
  const el = document.getElementById('admin-audit-table');
  if (!el) return;
  if (!logs.length) { el.innerHTML = '<p class="ch-empty">Aucun log.</p>'; return; }
  const actionColors = {
    'lock':'#fbbf24','unlock':'#4ade80','delete-user':'#ff4655','change-role':'#60a5fa',
    'reset-mfa':'#c084fc','create-announcement':'#34d399','delete-announcement':'#f87171'
  };
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
    <tbody>${logs.map(l => {
      const c = actionColors[l.action] || '#8b949e';
      return `<tr>
        <td style="color:var(--dim);font-size:0.75rem;white-space:nowrap">${new Date(l.created_at).toLocaleString('fr-FR')}</td>
        <td><strong>${san(l.actor_email || '—')}</strong></td>
        <td><span class="admin-badge" style="background:${c}22;color:${c}">${san(l.action)}</span></td>
        <td>${san(l.target_username || '—')}</td>
        <td style="color:var(--dim);font-size:0.78rem">${san(l.details || '')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function adminDeleteRelation(relId) {
  if (!confirm('Supprimer cette relation de coaching ?')) return;
  try {
    const res = await fetch(`${API_BASE}/coaching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'admin-delete-rel', rel_id: relId })
    });
    if (!res.ok) { alert('Erreur serveur'); return; }
    adminLoadRelations(); adminLoadStats();
  } catch { alert('Erreur réseau'); }
}

async function coachingRenderStudents() {
  const list = document.getElementById('ch-students-list');
  if (!list) return;
  list.innerHTML = '<p class="ch-empty">Chargement...</p>';

  try {
    const res = await fetch(`${API_BASE}/coaching?view=all-users`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) throw new Error('Erreur chargement');
    const data = await res.json();

    list.innerHTML = '';
    if (!data.users.length) { list.innerHTML = '<p class="ch-empty">Aucun utilisateur.</p>'; return; }

    data.users.forEach(s => {
      const roleLabels = { admin: 'Admin', coach: 'Coach', student: 'Eleve' };
      const card = document.createElement('div');
      card.className = 'ch-card';
      card.innerHTML = `
        <div class="ch-card-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${san(s.username)}${rankBadge(s.current_rank)}</div>
        <span class="ch-badge role-${s.role}">${roleLabels[s.role] || san(s.role)}</span>
        <div class="ch-card-meta" style="margin-top:8px">${san(s.email)}</div>
        ${s.objective ? `<div class="ch-card-desc" style="margin-top:4px">${icon('target',14)} ${san(s.objective)}</div>` : ''}
        <div class="ch-card-desc">Inscrit le ${new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
        ${coachingUserRole === 'admin' ? `
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <select class="ch-role-select" data-user-id="${s.id}" style="flex:1;padding:6px 10px;background:var(--bg);color:var(--txt);border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:0.8rem">
              <option value="student" ${s.role==='student'?'selected':''}>Eleve</option>
              <option value="coach" ${s.role==='coach'?'selected':''}>Coach</option>
              <option value="admin" ${s.role==='admin'?'selected':''}>Admin</option>
            </select>
            <button class="ch-delete-user-btn" data-user-id="${s.id}" data-username="${san(s.username)}"
              style="padding:6px 12px;background:rgba(255,70,85,0.15);color:#ff4655;border:1px solid rgba(255,70,85,0.4);border-radius:6px;font-size:0.75rem;cursor:pointer;white-space:nowrap;font-family:var(--font)">
              Supprimer
            </button>
          </div>
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
        const delBtn = card.querySelector('.ch-delete-user-btn');
        delBtn?.addEventListener('click', () => coachingDeleteUser(s.id, s.username));
      }
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = '<p class="ch-empty">Erreur de chargement.</p>';
  }
}

async function coachingDeleteUser(userId, username) {
  if (!confirm(`Supprimer le compte de "${username}" ? Cette action est irréversible.`)) return;
  try {
    const res = await fetch(`${API_BASE}/update-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'delete', userId })
    });
    const data = await res.json();
    if (data.error) { alert('Erreur : ' + data.error); return; }
    coachingRenderStudents();
  } catch (e) { alert('Erreur réseau'); }
}

// ============ ADMIN: MANAGE scenarios ============

async function seedScenariosToDb() {
  if (!coachingToken) return alert('Non connecte');
  const btn = document.getElementById('btn-seed-scenarios');
  if (btn) { btn.disabled = true; btn.textContent = 'Seeding...'; }
  try {
    const res = await fetch(`${API_BASE}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    alert(data.message || 'Seed termine !');
    await fetchScenariosFromDB();
    coachingRenderManageScenarios();
  } catch (e) {
    alert('Erreur seed : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Initialiser les scenarios (Seed DB)'; }
  }
}

function coachingRenderManageScenarios() {
  const list = document.getElementById('ch-manage-scenarios-list');
  if (!list) return;

  // Seed button for admin
  const wrap = list.parentElement;
  if (wrap && !document.getElementById('btn-seed-scenarios') && coachingUserRole === 'admin') {
    const seedBtn = document.createElement('button');
    seedBtn.id = 'btn-seed-scenarios';
    seedBtn.className = 'btn-primary';
    seedBtn.style.cssText = 'margin-bottom:16px;background:rgba(0,200,120,0.15);border:1px solid rgba(0,200,120,0.3);color:#00c878;';
    seedBtn.textContent = 'Initialiser les scenarios (Seed DB)';
    seedBtn.title = 'Peupler la DB avec les 15 scenarios Valorant par defaut (admin uniquement)';
    seedBtn.addEventListener('click', seedScenariosToDb);
    wrap.insertBefore(seedBtn, list);
  }

  list.innerHTML = '';

  coachingScenarios.forEach(s => {
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = `
      <span class="ch-badge">${s.rank || ''}</span>
      <div class="ch-card-title">${s.title}</div>
      <div class="ch-card-meta">${s.map || ''} \u00b7 ${s.type || ''}</div>
      <p class="ch-card-desc">${s.description || ''}</p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-primary ch-card-btn" style="flex:1">Editer</button>
        <button class="btn-qcm-scenario" style="padding:8px 14px;background:rgba(240,196,63,0.15);border:1px solid rgba(240,196,63,0.3);color:#f0c43f;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;font-family:var(--font);transition:all 0.12s">${icon('edit',14)} QCM</button>
        <button class="btn-del-scenario" style="padding:8px 14px;background:rgba(255,70,85,0.15);border:1px solid rgba(255,70,85,0.3);color:var(--accent);border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;font-family:var(--font);transition:all 0.12s">Supprimer</button>
      </div>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => coachingOpenEditModal(s));
    card.querySelector('.btn-qcm-scenario').addEventListener('click', () => _qcmOpenManager(s.id));
    card.querySelector('.btn-del-scenario').addEventListener('click', async () => {
      if (!confirm(`Supprimer le scénario "${s.title}" ?`)) return;
      try {
        if (coachingToken && s.id) {
          const res = await fetch(`${API_BASE}/scenarios`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
            body: JSON.stringify({ id: s.id })
          });
          if (!res.ok) { const r = await res.json(); throw new Error(r.error); }
        }
      } catch (e) { /* Only default scenarios can't be deleted from DB, still remove locally */ }
      const idx = coachingScenarios.findIndex(sc => sc.id === s.id);
      if (idx !== -1) coachingScenarios.splice(idx, 1);
      if (typeof deleteCustomScenarioMap === 'function') deleteCustomScenarioMap(s.id);
      persistScenarios();
      coachingRenderManageScenarios();
    });
    list.appendChild(card);
  });
}

let editingScenarioId = null;

function coachingOpenEditModal(scenario) {
  const modal = document.getElementById('ch-scenario-edit-modal');
  if (!modal) return;

  editingScenarioId = scenario ? scenario.id : null;
  document.getElementById('ch-se-modal-title').textContent = scenario ? 'Éditer le scénario' : 'Nouveau scénario';
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

  const saveBtn = document.getElementById('ch-se-save-btn');
  if (saveBtn) saveBtn.disabled = true;
  try {
    if (editingScenarioId) {
      data.id = editingScenarioId;
      const res = await fetch(`${API_BASE}/scenarios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const idx = coachingScenarios.findIndex(s => s.id === editingScenarioId);
      if (idx !== -1) Object.assign(coachingScenarios[idx], data);
    } else {
      const res = await fetch(`${API_BASE}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      data.id = result.scenario?.id || Date.now();
      coachingScenarios.push(data);
    }
    persistScenarios();
    coachingCloseEditModal();
    coachingRenderManageScenarios();
    err.style.display = 'none';
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ============ COURS & EXERCICES ============

const COURS_DATA = [
  {
    id: 'warmup',
    title: 'L\'Importance de l\'Échauffement',
    icon: icon('flame',18),
    tag: 'Essentiel',
    desc: 'Le warm-up est la différence entre une session frustrante et une session productive. Comprends pourquoi s\'échauffer physiquement, visuellement et en aim est non-négociable.',
    sections: [
      {
        title: 'Pourquoi la plupart des joueurs négligent le warm-up',
        content: `<p>La majorité des joueurs lancent directement une partie ranked sans s'être échauffés. Le résultat : les 3 premières rounds sont catastrophiques, ils s'énervent, et toute la session est compromise dès le départ.</p>
        <div class="cours-tip">Oblivity, coach Valorant professionnel, insiste dans toutes ses vidéos : "Le warm-up n'est pas optionnel. C'est la base. Si tu n'as pas 20 minutes pour t'échauffer, tu n'as pas le temps de jouer sérieusement."</div>
        <p>Le cerveau a besoin d'un temps d'activation pour connecter efficacement la vision, la coordination motrice fine, et les réflexes. Tu ne peux pas passer de 0 à 100% instantanément — aucun athlète professionnel ne le fait.</p>`
      },
      {
        title: 'Échauffement physique — Pourquoi les mains d\'abord',
        content: `<p>La souris est manipulée par des <strong>tendons et muscles fins du poignet et des doigts</strong>. Ces structures nécessitent une activation progressive pour performer et pour éviter les blessures (tendinite, syndrome du canal carpien).</p>
        <ul>
          <li><strong>Cercles de poignets :</strong> x10 dans chaque sens, lentement. Active la synovie articulaire.</li>
          <li><strong>Étirements des doigts :</strong> Étire chaque doigt vers l'arrière, maintiens 10s. Prévent les crampes mid-session.</li>
          <li><strong>Relâchement des épaules :</strong> Tensions accumulées = mouvements de bras rigides = aim inconsistant.</li>
          <li><strong>Posture :</strong> Vérifie ta position assise. Dos droit, coude à ~90°, poignet dans l'axe de l'avant-bras.</li>
        </ul>
        <div class="cours-tip">Des études sur les esportifs professionnels montrent que 60% d'entre eux ont développé des douleurs chroniques au poignet avant 25 ans. L'échauffement physique est une assurance long terme.</div>`
      },
      {
        title: 'Échauffement visuel — La dimension oubliée',
        content: `<p>Les yeux aussi ont besoin d'activation. Les muscles oculaires contrôlent les <strong>saccades</strong> (mouvements rapides vers une nouvelle cible) et le <strong>smooth pursuit</strong> (suivi d'une cible en mouvement) — exactement ce qu'on utilise en jeu.</p>
        <ul>
          <li><strong>Switch focus distance :</strong> Alterne regard proche/loin x15. Active l'accommodation rapide (crucial pour réagir aux ennemis qui apparaissent).</li>
          <li><strong>Tracking des bords d'écran :</strong> Suis lentement les 4 côtés avec les yeux. Réveille le suivi périphérique.</li>
          <li><strong>Saccades entraînées :</strong> Regarde 4 points fixes en ordre aléatoire rapidement x20. Améliore le temps de réaction visuelle.</li>
        </ul>
        <p>La <strong>fatigue oculaire</strong> est la cause #1 de baisse de performance invisible. Après 2h de jeu sans pause, tes yeux sont 30-40% moins efficaces dans les saccades rapides.</p>`
      },
      {
        title: 'Échauffement aim — La progression par phases',
        content: `<p>Le warm-up aim doit suivre une <strong>progression de difficulté stricte</strong>. Commencer fort est contre-productif — ça crée de la tension musculaire et des habitudes compensatoires.</p>
        <p><strong>Phase 1 — Tracking lent (Easier) :</strong> Active la connexion cerveau-souris. Aucune performance attendue. Fluidité uniquement.</p>
        <p><strong>Phase 2 — Clicking medium :</strong> Monte progressivement. La main doit être chaude mais pas fatiguée.</p>
        <p><strong>Phase 3 — Switch medium :</strong> Simule les situations de jeu réel. Transferts entre cibles, réflexes de changement de focus.</p>
        <div class="cours-tip">Total recommandé : 15-20 minutes. Oblivity utilise exactement cette structure dans sa routine quotidienne : Whisphere Easy → Pasu Medium → VoxTS Medium → Benchmark.</div>`
      },
      {
        title: 'Exercices de warm-up',
        type: 'exercises',
        exercises: [
          { mode: 'whisphere',    diff: 'easy',   name: 'Tracking Activation',  desc: 'Whisphere Easier — activer la connexion cerveau-souris, fluidité avant tout' },
          { mode: 'pasu_reload',  diff: 'medium', name: 'Clicking Warm-up',     desc: 'Pasu Reload Medium — precision de clic progressive' },
          { mode: 'vox_ts2',      diff: 'medium', name: 'Switch Activation',    desc: 'VoxTS Medium — transferts rapides entre cibles' },
        ]
      }
    ]
  },
  {
    id: 'crosshair_placement',
    title: 'Crosshair Placement',
    icon: icon('crosshair',18),
    tag: 'Fondamental',
    desc: 'Le placement du viseur est LA skill qui separe les joueurs Gold des Immortal. Apprends a toujours avoir ton crosshair au niveau de la tete, pre-aim les angles, et minimiser tes ajustements.',
    sections: [
      {
        title: 'Pourquoi c\'est la base absolue',
        content: `<p>Le crosshair placement consiste a <strong>toujours garder ton viseur la ou la tete de l'ennemi va apparaitre</strong>. Un bon placement signifie que tu n'as presque pas besoin de bouger ta souris pour tuer — tu cliques juste au bon moment.</p>
        <div class="cours-tip">Un joueur avec un bon crosshair placement et une aim mediocre battra TOUJOURS un joueur avec une aim incroyable mais un mauvais placement. C'est la skill avec le meilleur ratio effort/impact dans Valorant.</div>
        <p>En pratique : si ton crosshair est deja au niveau de la tete quand l'ennemi apparait, tu as besoin d'un micro-ajustement de quelques pixels. Si ton crosshair est au sol, tu as besoin de bouger ta souris de 30+ cm. La difference est enorme sous pression.</p>`
      },
      {
        title: 'Les 3 regles d\'or',
        content: `<ul>
          <li><strong>Hauteur de tete constante :</strong> Ton viseur doit TOUJOURS etre a hauteur de tete, même quand tu marches. Utilise les reperes visuels : bords de portes, caisses, lignes de mur. Sur Valorant, vise environ 70% de la hauteur d'un modele debout.</li>
          <li><strong>Pre-aim chaque angle :</strong> Avant de decouvrir un angle (en marchant lateralement), place ton crosshair EXACTEMENT ou l'ennemi pourrait se tenir. Si tu penses "il pourrait etre derrière cette caisse", ton crosshair doit etre sur le cote de cette caisse.</li>
          <li><strong>Suis les murs en avancant :</strong> Quand tu avances vers un angle inconnu, garde ton crosshair colle au mur/coin le plus proche d'ou un ennemi peut sortir. L'ennemi apparaitra dans ton viseur quasi automatiquement.</li>
        </ul>`
      },
      {
        title: 'Erreurs courantes et corrections',
        content: `<ul>
          <li><strong>Regarder le sol en marchant</strong> — Force-toi mentalement a "tenir" ton viseur en haut. Si tu l'as remarque, tu as deja fait la moitie du travail.</li>
          <li><strong>Crosshair au centre sans but</strong> — Ton viseur doit viser un angle specifique a tout moment. Si tu marches dans un couloir, il doit viser les deux coins en alternance.</li>
          <li><strong>Ne pas ajuster a la distance</strong> — Plus l'ennemi est loin, plus il se materialisera vite dans ton FOV. Ajuste ton pre-aim en consequence.</li>
          <li><strong>oubliér l'elevation</strong> — Sur Valorant, les positions hautes (Heaven, Box, Rafters) doivent faire partie de ton "rotation mentale" d'angles a verifier.</li>
          <li><strong>Bouger le crosshair avec sa souris apres le peek</strong> — Le crosshair doit etre en place AVANT de bouger, pas pendant. Planifie, puis avance.</li>
        </ul>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'crosshair_drill', diff: 'easy', name: 'Head Level Fondation', desc: 'Cibles fixes a hauteur de tete — clique vite, aucun ajustement nécessaire' },
          { mode: 'crosshair_drill', diff: 'medium', name: 'Pre-aim des Angles', desc: 'Cibles apparaissant aux coins — pre-aim la position avant le spawn' },
          { mode: 'crosshair_drill', diff: 'hard', name: 'Reaction Pure Multi-angle', desc: 'Cibles rapides dans tout le FOV — crosshair placement + reflexes combines' },
        ]
      }
    ]
  },
  {
    id: 'deadzoning',
    title: 'Deadzoning & Tracking',
    icon: icon('circle-dot',18),
    tag: 'Avance',
    desc: 'Le deadzoning est la technique de tracking qui te permet de suivre une cible de maniere fluide et precise, en maintenant ton viseur dans une zone optimale autour de la cible.',
    sections: [
      {
        title: 'Qu\'est-ce que le deadzoning ?',
        content: `<p>La <strong>deadzone</strong> est une zone imaginaire autour de ta cible. Tant que ton viseur reste dans cette zone, tu n'as pas besoin de corriger. L'idee est de <strong>bouger ta souris de maniere fluide</strong> en suivant le mouvement general de la cible, plutot que de faire des micro-ajustements frenetiques.</p>
        <div class="cours-tip">Pense au tracking comme a conduire une voiture : tu ne tournes pas le volant de maniere saccadee, tu fais des ajustements progressifs et fluides. Le deadzoning, c'est accepter que tu n'as pas besoin d'etre pixel-perfect a chaque frame — la fluidite prime sur la precision brute.</div>
        <p>En jeu, le deadzoning s'applique dans les situations ou l'ennemi bouge : spray transfer, peek qui court, strafe A-D. Au lieu de "chasser" pixel par pixel, tu maintiens une zone de 5-10 pixels autour de la cible et tu tires en continu.</p>`
      },
      {
        title: 'Comment pratiquer efficacement',
        content: `<ul>
          <li><strong>Phase 1 — Deadzone large :</strong> Commence par accepter une grande zone (20-30px). Concentre-toi uniquement sur la direction generale. Aucune micro-correction.</li>
          <li><strong>Phase 2 — Resserre progressivement :</strong> Reduis mentalement ta zone acceptable. Tes mouvements deviennent naturellement plus precis sans que tu forces.</li>
          <li><strong>Phase 3 — Smooth tracking :</strong> La priorité est la fluidite du mouvement. Un tracking smooth a 85% de precision est supérieur a un tracking saccade a 90%.</li>
          <li><strong>Phase 4 — Mouvements de poignet :</strong> Pour les cibles rapides et impredictibles, switch du mouvement de bras vers le poignet pour des corrections plus rapides.</li>
        </ul>
        <div class="cours-tip">Si tu n'arrives pas a etre smooth, baisse ta sensibilite. Un cm/360 entre 30-45cm est ideal pour le tracking Valorant. Plus haut = trop de precision nécessaire. Plus bas = trop lent pour les corrections rapides.</div>`
      },
      {
        title: 'Application en jeu Valorant',
        content: `<p>Le deadzoning s'applique dans ces situations concretes :</p>
        <ul>
          <li><strong>A-D spam ennemi :</strong> Ne pas essayer de suivre chaque micro-mouvement. Garde ton viseur sur le centre de l'oscillation et tire dans la deadzone.</li>
          <li><strong>Ennemi qui court vers toi :</strong> Suivi de bras, mouvement progressif, pas de corrections brusques.</li>
          <li><strong>Spray transfer :</strong> Apres le premier kill, swing vers la nouvelle cible et entre dans sa deadzone avant de continuer a tirer.</li>
          <li><strong>Jiggle peek :</strong> Maintiens ton crosshair sur l'angle, ne "chasse" pas le mouvement. L'ennemi reviendra dans ta deadzone.</li>
        </ul>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'deadzone_drill', diff: 'easy', name: 'Suivi Fluide — Introduction', desc: 'Cible lente et large — apprends la deadzone, reste smooth et ne sur-corrige pas' },
          { mode: 'deadzone_drill', diff: 'medium', name: 'Changements de Direction', desc: 'Cible qui change brusquement — anticipe la direction, ne poursuis pas a la reaction' },
          { mode: 'deadzone_drill', diff: 'hard', name: 'Deadzone Precision Maximale', desc: 'Petite cible rapide — deadzone serree, mouvements de poignet pour les corrections' },
        ]
      }
    ]
  },
  {
    id: 'burst_control',
    title: 'Burst & Spray Control',
    icon: icon('square',18),
    tag: 'Fondamental',
    desc: 'Maitriser le burst et le spray control est essentiel pour dominer les gunfights. Apprends quand tapper, burster ou sprayer, et comment le counter-strafe change tout.',
    sections: [
      {
        title: 'Tap vs Burst vs Spray',
        content: `<ul>
          <li><strong>Tap (1 balle) :</strong> Longue distance (30m+). Clique une fois, attends que le recul se reset complètement (~0.5s), reclique. Ideal pour Vandal et Guardian.</li>
          <li><strong>Burst (2-4 balles) :</strong> Moyenne distance (10-25m). Le SWEET SPOT sur Valorant. 2 balles Vandal = headshot + body = kill. 3 balles Phantom = kill quasi garanti. La majorite de tes kills doivent venir de bursts.</li>
          <li><strong>Spray (5+ balles) :</strong> Courte distance UNIQUEMENT (moins de 10m). Tire en continu en poussant vers le bas. Spectre, ou Phantom/Vandal au corps a corps. Ne JAMAIS sprayer a moyenne distance.</li>
        </ul>
        <div class="cours-tip">La regle d'or : si tu rates tes 2-3 premieres balles, STOP. Deplace-toi (counter-strafe), reset, recommence un burst propre. Un spray desespere a moyenne distance te fera perdre quasi a coup sur.</div>`
      },
      {
        title: 'Counter-strafing : la technique clé',
        content: `<p>Le <strong>counter-strafe</strong> te permet de t'arreter INSTANTANEMENT pour tirer avec precision :</p>
        <ul>
          <li>Tu te deplaces avec <span class="cours-key">A</span> — appuie brievement sur <span class="cours-key">D</span> pour annuler la vitesse</li>
          <li>Au moment EXACT ou ta vitesse est 0 → tu burst (c'est une fraction de seconde)</li>
          <li>Apres le burst → repars immédiatement dans une direction</li>
          <li>Repete : strafe → counter → burst → strafe</li>
        </ul>
        <p>Sans counter-strafe, tes balles partent en dehors de la tete même si ton crosshair est dessus. Avec le counter-strafe, tes balles vont exactement ou ton crosshair pointe.</p>
        <div class="cours-tip">Exercice : mets-toi sur le range, deplace-toi en A-D et essaie de headshot la cible. Tu verras immédiatement si tu counter-strafe correctement.</div>`
      },
      {
        title: 'Spray patterns Valorant',
        content: `<p>Sur Valorant, le spray est plus simple qu'a CS mais demande quand même de la pratique :</p>
        <ul>
          <li><strong>Balles 1-4 :</strong> Montent vers le haut → commence a tirer vers le bas pour compenser</li>
          <li><strong>Balles 5-10 :</strong> Pattern horizontal aleatoire → microadjustements gauche/droite</li>
          <li><strong>Balles 10+ :</strong> Quasi aleatoire → evite absolument d'en arriver la a distance</li>
        </ul>
        <p><strong>Vandal vs Phantom :</strong> Le Vandal a un recul plus fort mais tue en 2 balles tete. Le Phantom est plus facile a controller mais nécessite parfois 3 balles. Pour progresser, entraine-toi avec les 2.</p>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'burst_drill', diff: 'easy', name: 'Burst Timing Fondation', desc: 'Cibles statiques — 2-3 clics rapides par cible, simule le tap-burst sur cible immobile' },
          { mode: 'burst_drill', diff: 'medium', name: 'Burst sur Cible Mobile', desc: 'Cibles qui bougent — counter-strafe interne, burst propre puis repositionne' },
          { mode: 'burst_drill', diff: 'hard', name: 'Spray Transfer Rapide', desc: 'Cibles multiples avec HP — gere le recul et transfer entre les cibles sans pause' },
        ]
      }
    ]
  },
  {
    id: 'movement',
    title: 'Movement & Peeking',
    icon: icon('chevron-right',18),
    tag: 'Intermediaire',
    desc: 'Le mouvement est la base de tout en FPS tactique. Jiggle peek, wide swing, slice the pie — chaque technique a son utilité et sa situation optimale.',
    sections: [
      {
        title: 'Les types de peeks et quand les utiliser',
        content: `<ul>
          <li><strong>Jiggle peek :</strong> Tu exposés juste une partie de ton corps pour prendre l'info ou forcer un tir ennemi, puis tu rentres. Tu ne tires PAS. Utilise-le pour localiser un ennemi en sécurité ou pour baiter un AWP.</li>
          <li><strong>Wide swing :</strong> Tu sors large et rapide pour surprendre un joueur qui tient un angle serre. Le timing est crucial : tu counter-strafe + burst immédiatement en sortant. Fonctionne contre les joueurs qui tiennent trop pres du mur.</li>
          <li><strong>Shoulder peek :</strong> Tu montres juste ton epaule (sans exposér la tete) pour baiter le tir d'un Operator, puis tu re-peek pendant qu'il bolt-action. Tres efficace contre les snipers.</li>
          <li><strong>Crouch peek :</strong> Tu sors en crouchant pour surprendre un joueur qui vise a hauteur de tete debout. Deconseille en general car tu deviens lent — utilise ponctuellement et jamais deux fois de suite.</li>
        </ul>`
      },
      {
        title: 'Slice the pie : la technique fondamentale',
        content: `<p>Le "slice the pie" consiste a <strong>decouvrir un angle progressivement</strong> en se deplacant lateralement plutot que de rusher droit dedans.</p>
        <p>Methode : imagine l'angle comme un gateau. Tu en coupes une tranche a la fois en te deplacant lateralement. A chaque tranche, tu verifie qu'il n'y a personne avant de passer a la suivante.</p>
        <div class="cours-tip">La distance au mur est cruciale : trop pres = angle mort trop long a decouvrir. Trop loin = tu es exposé avant d'avoir vu l'ennemi. La distance ideale te permet de voir l'angle progressivement tout en gardant une couverture.</div>
        <p>Combine toujours le slice the pie avec un bon crosshair placement : ton viseur doit etre exactement la ou la prochaine "tranche" peut contenir un ennemi.</p>`
      },
      {
        title: 'Mouvement avance : timings et peeks agressifs',
        content: `<ul>
          <li><strong>Peek agressif en debut de round :</strong> Sortir tôt et agressivement peut surprendre un defender qui se setup encore. Fonctionne dans les premiers 5-8 secondes.</li>
          <li><strong>Counter-peek :</strong> Quand un ennemi peeks ton angle, tu peux le counter-peek simultanément — son peek devient prévisible et tu peux pre-aim sa trajectoire.</li>
          <li><strong>Repositionnement apres un kill :</strong> Ne reste JAMAIS au même endroit apres un kill. L'ennemi sait exactement ou tu es. Deplace-toi avant que ses mates pushent.</li>
          <li><strong>Peekers advantage :</strong> Celui qui peeks voit l'autre en premier. Exploite ca en etant toujours celui qui initie le duel.</li>
        </ul>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'crosshair_drill', diff: 'medium', name: 'Peek & Placement', desc: 'Cibles aux coins — pre-aim l\'angle avant qu\'il se revele, simule le slice the pie' },
          { mode: 'pokeball_frenzy', diff: 'medium', name: 'Wide Swing Reaction', desc: 'Cibles partout dans le FOV — flicks rapides qui simulent les wide swings agressifs' },
          { mode: 'w1w3ts_reload', diff: 'medium', name: 'Counter-peek & Fire', desc: 'Target switch rapide — simule les counter-peeks et repositionnements instantanes' },
        ]
      }
    ]
  },
  {
    id: 'flick_aim',
    title: 'Flicks & Reactivite',
    icon: icon('zap',18),
    tag: 'Intermediaire',
    desc: 'Les flicks sont indispensables dans Valorant — pour repondre a un peek inattendu, un wide swing ennemi, ou un retake rapide. Developpe ta precision et ta vitesse de reaction.',
    sections: [
      {
        title: 'Anatomie d\'un bon flick',
        content: `<p>Un flick est un mouvement rapide et precis vers une cible inattendue. La plupart des joueurs pensent que les flicks dependent de la vitesse de reaction — en realite, ils dependent surtout du <strong>crosshair placement et de la lecture du jeu</strong>.</p>
        <ul>
          <li><strong>Pre-aim :</strong> Si ton crosshair est deja proche de l'ennemi, le "flick" n'est qu'un micro-ajustement. Le meilleur flick est celui que tu n'as presque pas besoin de faire.</li>
          <li><strong>Mouvement de bras vs poignet :</strong> Les gros flicks (50+ degres) se font au bras. Les flicks courts et precis (moins de 30 degres) se font au poignet. Apprends a switcher naturellement.</li>
          <li><strong>Precision > Vitesse :</strong> Un flick lent et precis bat un flick rapide et rate. La vitesse vient avec la pratique — la precision doit etre prioritaire.</li>
        </ul>
        <div class="cours-tip">Ne cherche pas a "snapper" sur la tete. Le vrai skill c'est d'atterrir pres de la tete avec ton premier flick, pas de headshot direct. Le headshot vient avec des milliers d'heures de pratique.</div>`
      },
      {
        title: 'Vitesse de reaction vs lecture',
        content: `<p>La reaction pure (voir → bouger la souris) est d'environ 200-250ms pour un humain normal. Ce n'est pas assez rapide pour repondre a un peek dans Valorant si tu pars de zero.</p>
        <p>La solution : la <strong>lecture du jeu</strong>. Si tu anticipes qu'un ennemi peut apparaitre depuis un angle, ton cerveau est deja "pre-charge" pour cette reaction — tu reagis en 150ms au lieu de 250ms. C'est pour ca que le crosshair placement et la lecture sont si importants.</p>
        <ul>
          <li>Identifie les angles dangereux avant de les approcher</li>
          <li>Anticipe les mouvements ennemis selon l'eco, le round time, les infos</li>
          <li>Pre-aim les spots de spawn communs (les ennemis vont souvent aux mêmes endroits)</li>
        </ul>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'pokeball_frenzy', diff: 'easy', name: 'Flick Introduction', desc: 'Cibles larges partout dans le FOV — prends confiance, priorité a la precision' },
          { mode: 'beants', diff: 'medium', name: 'Stabilite Post-flick', desc: 'Target switch avec cibles stables — travaille l\'atterrissage et la micro-correction' },
          { mode: 'w1w3ts_reload', diff: 'hard', name: 'Flick + Fire Rapide', desc: 'Flicks serres avec reload — simule les duels rapides de haute intensite' },
        ]
      }
    ]
  },
  {
    id: 'game_sense',
    title: 'Game Sense & Info',
    icon: icon('eye',18),
    tag: 'stratégique',
    desc: 'L\'aim seul ne suffit pas. Le game sense — savoir ou sont les ennemis, quand pousser, quand rotate — c\'est ce qui fait la difference entre un joueur qui stagne et un joueur qui climb.',
    sections: [
      {
        title: 'Lire le jeu : les fondamentaux',
        content: `<ul>
          <li><strong>Compte les ennemis en permanence :</strong> Toujours savoir combien sont en vie et ou ils ont ete vus EN DERNIER. Si 3 sont signales B, il n'en reste que 2 pour A + mid — c'est un avantage numérique exploitable.</li>
          <li><strong>écoute les sons activement :</strong> Les pas, les utils, les reloads donnent de l'info gratuite. Un joueur qui active une smoke B = probablement une execute B imminente. Un reload = il vient de tuer ou il est en position.</li>
          <li><strong>Lire l'economie adverse :</strong> Si l'équipe adverse a perdu 3 rounds de suite, ils sont probablement en eco (pistolets/shorties). Expect les rushes et les angles inattendus.</li>
          <li><strong>Pattern recognition :</strong> Si l'équipe adverse fait le même play 2 rounds de suite, adapte-toi au 3ème. La plupart des équipes n'ont pas plus de 5-6 strats differentes.</li>
        </ul>`
      },
      {
        title: 'Timing et prise de decision',
        content: `<p>Le timing est une des dimensions les plus sous-estimees du game sense :</p>
        <ul>
          <li><strong>Early round (0-15s) :</strong> Phase d'info. Ne prends pas de risques inutiles. Priorise la collecte d'info et le setup de positions.</li>
          <li><strong>Mid round (15-35s) :</strong> Phase de decision. Execute selon l'info disponible ou adapte ton plan.</li>
          <li><strong>Late round (35s+) :</strong> Phase de clutch. Les regles changent complètement. Un joueur doit jouer pour le temps si l'équipe perd.</li>
        </ul>
        <div class="cours-tip">Avant chaque round, pose-toi 3 questions : Ou sont-ils probablement ? Quel est leur plan le plus probable ? Quelle est notre meilleure reponse ? Ca prend 3 secondes et change complètement ton efficacite.</div>`
      },
      {
        title: 'Communication : l\'arme secrete',
        content: `<p>L'info ne sert a rien si tu ne la partages pas efficacement :</p>
        <ul>
          <li><strong>Court et precis :</strong> "2 B main" et non "je crois qu'il y a peut-etre des gens B quelque part"</li>
          <li><strong>Callout + nombre + HP si possible :</strong> "3 A main, un est bas HP"</li>
          <li><strong>Ne parle pas pendant un clutch</strong> (sauf info vraiment critique)</li>
          <li><strong>Ne tilt pas en vocal</strong> — ca fait perdre plus de rounds que la mauvaise aim. Un joueur tilt = équipe tilt = round perdu.</li>
          <li><strong>Les calls proactifs battent les calls reactifs</strong> — dire "je pense qu'ils vont execute B" AVANT l'execute est infiniment plus utile que "ils executent B" quand c'est trop tard.</li>
        </ul>`
      },
      {
        title: 'Exercices pratiques',
        type: 'exercises',
        exercises: [
          { mode: 'pasu_reload', diff: 'easy', name: 'Reaction sur Angle', desc: 'Cibles qui apparaissent — travaille la rapidite de detection et de reaction sur angle tenu' },
          { mode: 'flicker_plaza', diff: 'medium', name: 'Multi-Info Tracking', desc: 'Suivi reactif multi-cibles — gere plusieurs menaces comme en clutch ou en retake' },
        ]
      }
    ]
  }
];

function getCoursProgress() {
  try { return JSON.parse(localStorage.getItem('ch_cours_progress') || '{}'); } catch { return {}; }
}
function markCoursComplete(id) {
  const p = getCoursProgress();
  p[id] = true;
  localStorage.setItem('ch_cours_progress', JSON.stringify(p));
}

function coachingRenderCours() {
  const list = document.getElementById('cours-list');
  if (!list) return;
  list.innerHTML = '';
  const progress = getCoursProgress();

  COURS_DATA.forEach(c => {
    const done = progress[c.id];
    const exerciseCount = c.sections.filter(s => s.type === 'exercises').reduce((acc, s) => acc + s.exercises.length, 0);
    const card = document.createElement('div');
    card.className = 'cours-card' + (done ? ' ch-done' : '');
    card.innerHTML = `
      <div class="cours-card-icon">${c.icon}</div>
      <span class="cours-tag">${c.tag}</span>
      ${done ? '<span class="ch-badge-done" style="margin-left:6px">Complete</span>' : ''}
      <h3>${c.title}</h3>
      <p>${c.desc}</p>
      <div style="margin-top:10px;font-size:0.7rem;color:var(--dim)">${c.sections.length - (c.sections.filter(s=>s.type==='exercises').length)} lecons &middot; ${exerciseCount} exercices</div>
      <div class="cours-progress"><div class="cours-progress-fill" style="width:${done ? 100 : 0}%"></div></div>
    `;
    card.addEventListener('click', () => openCoursDetail(c));
    list.appendChild(card);
  });
}

function openCoursDetail(cours) {
  // Hide cours list, show detail
  document.getElementById('ch-cours').classList.remove('active');
  document.getElementById('ch-cours-detail').classList.add('active');

  const container = document.getElementById('cours-content');
  let html = `<div class="cours-detail-header">
    <span class="cours-tag">${cours.tag}</span>
    <h2>${cours.icon} ${cours.title}</h2>
    <p style="color:var(--dim);font-size:0.85rem;margin-top:4px">${cours.desc}</p>
  </div>`;

  cours.sections.forEach(s => {
    html += `<div class="cours-section">`;
    html += `<h3>${s.title}</h3>`;
    if (s.type === 'exercises') {
      html += `<p style="margin-bottom:10px;color:var(--dim);font-size:0.8rem">Lance un exercice pour pratiquer ce concept :</p>`;
      html += `<div class="cours-exercises">`;
      s.exercises.forEach(ex => {
        html += `<div class="cours-exercise-btn" data-mode="${ex.mode}" data-diff="${ex.diff}">
          <h4>${ex.name}</h4>
          <p>${ex.desc}</p>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += s.content;
    }
    html += `</div>`;
  });

  const progress = getCoursProgress();
  const done = progress[cours.id];
  html += `<button class="cours-done-btn" data-cours-id="${cours.id}">${done ? 'Deja complete !' : 'Marquer comme termine'}</button>`;

  container.innerHTML = html;

  // Wire exercise buttons
  container.querySelectorAll('.cours-exercise-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const diff = btn.dataset.diff;
      // Go to menu, set diff, start game
      _setCoachLaunchSource('ch-cours');
      
      coachingSwitchTab('hub-home');
      document.getElementById('opt-diff').value = diff;
      setTimeout(() => {
        const modeBtn = document.querySelector(`.mode-card[data-mode="${mode}"]`);
        if (modeBtn) modeBtn.click();
        else if (typeof startGame === 'function') startGame(mode);
      }, 100);
    });
  });

  // Wire complete button
  container.querySelector('.cours-done-btn')?.addEventListener('click', function() {
    markCoursComplete(cours.id);
    this.textContent = 'Deja complete !';
    this.style.opacity = '0.6';
  });
}

// Back button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cours-back')?.addEventListener('click', () => {
    document.getElementById('ch-cours-detail').classList.remove('active');
    document.getElementById('ch-cours').classList.add('active');
    coachingRenderCours();
  });
});

// ============ MAP EDITOR ============

const ME = {
  currentMap: 'Bind',
  currentTool: 'player_t',
  steps: [{ label:'Step 1', elements:[] }],
  currentStep: 0,
  arrowStart: null, // for 2-click arrow/sightline
  dragging: null, dragIdx: -1,
  editingScenario: null, // { id, title, map } when editing a scénario's map
  rotation: 0,
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

  // Rotation buttons
  document.querySelectorAll('.me-rot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.me-rot-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ME.rotation = parseInt(btn.dataset.rot) || 0;
      meApplyRotation();
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
  if (typeof MAP_DATA === 'undefined') return;
  const img = document.getElementById('me-map-img');
  const mapData = MAP_DATA[ME.currentMap];
  if (img && mapData) { img.src = mapData.img; meApplyRotation(); }
}

function meApplyRotation() {
  const img = document.getElementById('me-map-img');
  if (img) img.style.transform = ME.rotation ? `rotate(${ME.rotation}deg)` : '';
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
    rotation: ME.rotation,
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
  ME.rotation = s.rotation || 0;
  document.getElementById('me-map-select').value = s.map;
  document.querySelectorAll('.me-rot-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.rot) === ME.rotation);
  });
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
    item.innerHTML = `<span style="font-weight:700">${san(s.name)}</span> <span style="color:var(--dim);font-size:0.7rem">${san(s.map)}</span> <span class="me-del" data-idx="${i}">&times;</span>`;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('me-del')) { meDeleteStrat(parseInt(e.target.dataset.idx)); return; }
      meLoadStrat(i);
    });
    list.appendChild(item);
  });
}

// Open Map Editor pre-loaded with a scénario's map data
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
  ME.rotation = source?.rotation || 0;

  document.getElementById('me-map-select').value = ME.currentMap;
  // Update rotation buttons
  document.querySelectorAll('.me-rot-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.rot) === ME.rotation);
  });

  // Switch to map editor tab
  coachingSwitchTab('ch-map-editor');

  // Show scénario banner + save button
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
      <button id="me-save-scenario-map" class="btn-primary" style="padding:8px 18px;font-size:0.8rem">Sauvegarder pour ce scénario</button>
      <button id="me-cancel-scenario" class="btn-secondary" style="padding:8px 14px;font-size:0.8rem">Annuler</button>
    </div>
  `;

  document.getElementById('me-save-scenario-map').addEventListener('click', () => {
    const s = ME.editingScenario;
    if (!s) return;
    saveCustomScenarioMap(s.id, ME.currentMap, JSON.parse(JSON.stringify(ME.steps)), ME.rotation);
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

// ============ HISTORIQUE ============

// Mode metadata: label and category for display
const _HM = {
  whisphereraw:   { label:'WhisphereRawControl',         cat:'control_tracking',  type:'track' },
  whisphere:      { label:'Whisphere',                   cat:'control_tracking',  type:'track' },
  smoothbot:      { label:'SmoothBot Goated',            cat:'control_tracking',  type:'track' },
  leaptrack:      { label:'Leaptrack Goated',            cat:'control_tracking',  type:'track' },
  ctrlsphere_aim: { label:'Controlsphere rAim',          cat:'control_tracking',  type:'track' },
  vt_ctrlsphere:  { label:'VT Controlsphere',            cat:'control_tracking',  type:'track' },
  air_angelic:    { label:'Air Angelic 4',               cat:'control_tracking',  type:'track' },
  cloverraw:      { label:'Cloverrawcontrol',            cat:'control_tracking',  type:'track' },
  ctrlsphere_far: { label:'Controlsphere Far',           cat:'control_tracking',  type:'track' },
  pgti:           { label:'PGTI Voltaic Easy',           cat:'control_tracking',  type:'track' },
  air_celestial:  { label:'Air CELESTIAL',               cat:'control_tracking',  type:'track' },
  whisphere_slow: { label:'Whisphere Slow',              cat:'control_tracking',  type:'track' },
  ground_plaza:   { label:'Ground Plaza Sparky',         cat:'reactive_tracking', type:'track' },
  ctrlsphere_ow:  { label:'Controlsphere OW',            cat:'reactive_tracking', type:'track' },
  flicker_plaza:  { label:'Flicker Plaza rAim',          cat:'reactive_tracking', type:'track' },
  polarized_hell: { label:'Polarized Hell',              cat:'reactive_tracking', type:'track' },
  air_pure:       { label:'Air Pure',                    cat:'reactive_tracking', type:'track' },
  air_voltaic:    { label:'Air Voltaic',                 cat:'reactive_tracking', type:'track' },
  pokeball_frenzy:{ label:'Pokeball Frenzy',             cat:'flick_tech',        type:'click' },
  w1w3ts_reload:  { label:'1w3ts Reload',                cat:'flick_tech',        type:'click', useHits:true },
  vox_ts2:        { label:'voxTargetSwitch 2',           cat:'flick_tech',        type:'click', useHits:true },
  beants:         { label:'BeanTS',                      cat:'flick_tech',        type:'click', useHits:true },
  floatts:        { label:'FloatTS Angelic',             cat:'flick_tech',        type:'click', useHits:true },
  waldots:        { label:'WaldoTS',                     cat:'flick_tech',        type:'click', useHits:true },
  devts:          { label:'devTS NR Goated 5Bot',        cat:'flick_tech',        type:'click', useHits:true },
  domiswitch:     { label:'domiSwitch',                  cat:'flick_tech',        type:'click' },
  tamts:          { label:'tamTargetSwitch',             cat:'flick_tech',        type:'click', useHits:true },
  pasu_reload:    { label:'Pasu Reload',                 cat:'click_timing',      type:'click', useHits:true },
  vt_bounceshot:  { label:'VT Bounceshot',               cat:'click_timing',      type:'click' },
  ctrlsphere_clk: { label:'Controlsphere Click',         cat:'click_timing',      type:'click', useHits:true },
  popcorn_mv:     { label:'Popcorn MV',                  cat:'click_timing',      type:'click', useHits:true },
  pasu_angelic:   { label:'Pasu Angelic',                cat:'click_timing',      type:'click', useHits:true },
  pasu_perfected: { label:'1w2ts Pasu Perfected',        cat:'click_timing',      type:'click', useHits:true },
  pasu_micro:     { label:'Pasu Perfected Micro',        cat:'click_timing',      type:'click' },
  floatheads_t:   { label:'Floating Heads Timing',       cat:'click_timing',      type:'click' },
  vox_click:      { label:'voxTargetClick',              cat:'click_timing',      type:'click', useHits:true },
  crosshair_drill:{ label:'Crosshair Placement',         cat:'cours',             type:'click' },
  deadzone_drill: { label:'Deadzone Drill',              cat:'cours',             type:'track' },
  burst_drill:    { label:'Burst Transfer',              cat:'cours',             type:'click' },
  strafe_drill:   { label:'Strafe Drill',                cat:'cours',             type:'track' },
  reaction_drill: { label:'Reaction Drill',              cat:'cours',             type:'click' },
  micro_drill:    { label:'Micro Precision',             cat:'cours',             type:'click' },
  gridshot:       { label:'Gridshot',                    cat:'cours',             type:'click' },
  speedflick:     { label:'Speed Flick',                 cat:'cours',             type:'click' },
};
const _CAT_LABELS_H = {
  all:'Tous', control_tracking:'Control Tracking', reactive_tracking:'Reactive Tracking',
  flick_tech:'Flick Tech', click_timing:'Click Timing', cours:'Cours / Drills',
};

let _historyFilter = 'all';
async function coachingRenderHistory() {
  const el = document.getElementById('ch-history-content');
  if (!el) return;
  if (!coachingToken) { el.innerHTML = '<p class="ch-empty">Connecte-toi pour voir ton historique.</p>'; return; }
  el.innerHTML = '<p class="ch-empty">Chargement...</p>';
  try {
    const res = await fetch(`${API_BASE}/history?limit=200`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) throw new Error('Erreur serveur');
    const { history } = await res.json();
    if (!history || !history.length) {
      el.innerHTML = '<p class="ch-empty">Aucune partie jouée pour le moment.</p>';
      renderHistoryChart([]);
      return;
    }
    _historyData = history;
    _renderHistoryUI(history);
  } catch(e) { el.innerHTML = `<p class="ch-empty">Erreur: ${san(e.message)}</p>`; }
}

function _renderHistoryUI(history) {
  const el = document.getElementById('ch-history-content');
  if (!el) return;

  const fmt  = d => new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  const fmtR = v => v > 0 ? v+'ms' : '—';
  const mLabel = m => (_HM[m]?.label) || m.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const mCat   = m => _HM[m]?.cat || 'other';
  const isTrack = m => _HM[m]?.type === 'track';
  const isUseHits = m => !!_HM[m]?.useHits;

  // Category filter: which cats appear in data
  const presentCats = [...new Set(history.map(h => mCat(h.mode)))];
  const cats = ['all', ...Object.keys(_CAT_LABELS_H).filter(c => c !== 'all' && presentCats.includes(c))];

  // Filter by category
  const filtered = _historyFilter === 'all'
    ? history
    : history.filter(h => mCat(h.mode) === _historyFilter);

  // Per-mode PB (by score)
  const pbByMode = {};
  history.forEach(h => {
    if (!pbByMode[h.mode] || h.score > pbByMode[h.mode]) pbByMode[h.mode] = h.score;
  });

  // Summary stats for filtered set
  const n = filtered.length;
  const totalTime = filtered.reduce((s,h) => s + (h.duration||0), 0);
  const avgAcc = n ? Math.round(filtered.reduce((s,h) => s + (h.accuracy||0), 0) / n) : 0;
  const avgReact = (() => {
    const wR = filtered.filter(h => h.avg_reaction > 0);
    return wR.length ? Math.round(wR.reduce((s,h) => s + h.avg_reaction, 0) / wR.length) : 0;
  })();
  const fmtTime = s => s >= 3600 ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` : s >= 60 ? `${Math.floor(s/60)}m` : `${s}s`;

  // Main score metric per row: hits for useHits, accuracy% for tracking, score for others
  const rowMetric = h => {
    if (isTrack(h.mode))    return { val: `${h.accuracy??0}%`,                 label: 'On-Target' };
    if (isUseHits(h.mode))  return { val: (h.hits??0).toString(),              label: 'Hits' };
    return                         { val: Number(h.score).toLocaleString(),     label: 'Score' };
  };

  el.innerHTML = `
    <!-- Category filter tabs -->
    <div class="hist-filter-wrap">
      ${cats.map(c => `<button class="hist-filter-btn${_historyFilter===c?' active':''}" onclick="_historySetFilter('${c}')">${_CAT_LABELS_H[c]||c}</button>`).join('')}
    </div>

    <!-- Stats summary strip -->
    <div class="hist-summary-strip">
      <div class="hist-summary-item">
        <span class="hist-summary-val">${n}</span>
        <span class="hist-summary-lbl">${icon('gamepad',13)} Parties</span>
      </div>
      <div class="hist-summary-item">
        <span class="hist-summary-val">${fmtTime(totalTime)}</span>
        <span class="hist-summary-lbl">${icon('training',13)} Temps total</span>
      </div>
      <div class="hist-summary-item">
        <span class="hist-summary-val">${avgAcc}%</span>
        <span class="hist-summary-lbl">${icon('target',13)} Précision moy.</span>
      </div>
      ${avgReact ? `<div class="hist-summary-item">
        <span class="hist-summary-val">${avgReact}ms</span>
        <span class="hist-summary-lbl">${icon('zap',13)} Réaction moy.</span>
      </div>` : ''}
    </div>

    <!-- History table -->
    <div class="hist-table-scroll">
      <table class="admin-table hist-table">
        <thead><tr>
          <th>Scénario</th>
          <th>Catégorie</th>
          <th style="text-align:right">Perf.</th>
          <th style="text-align:right">Précision</th>
          <th style="text-align:right">Hits</th>
          <th style="text-align:right">Misses</th>
          <th style="text-align:right">Réaction</th>
          <th style="text-align:right">Combo</th>
          <th style="text-align:right">Durée</th>
          <th style="text-align:right">Date</th>
        </tr></thead>
        <tbody>${filtered.map(h => {
          const isPB = pbByMode[h.mode] === h.score && h.score > 0;
          const rm   = rowMetric(h);
          const catKey = mCat(h.mode);
          const catLbl = _CAT_LABELS_H[catKey] || catKey;
          const catClr = catKey==='control_tracking'?'#60a5fa':catKey==='reactive_tracking'?'#c084fc':catKey==='flick_tech'?'#fbbf24':catKey==='click_timing'?'#4ade80':'#94a3b8';
          const dur  = h.duration ? `${h.duration}s` : '—';
          return `<tr class="${isPB ? 'hist-row-pb' : ''}">
            <td>
              <span class="hist-mode-badge">${san(mLabel(h.mode))}</span>
              ${isPB ? `<span class="hist-pb-tag">${icon('star',11)} PB</span>` : ''}
            </td>
            <td><span class="hist-cat-pill" style="color:${catClr};border-color:${catClr}20;background:${catClr}12">${catLbl}</span></td>
            <td style="text-align:right;font-weight:700;color:var(--accent)">${san(rm.val)}</td>
            <td style="text-align:right">${h.accuracy ?? '—'}%</td>
            <td style="text-align:right;color:#4ade80">${h.hits ?? '—'}</td>
            <td style="text-align:right;color:#f87171">${h.misses ?? '—'}</td>
            <td style="text-align:right">${fmtR(h.avg_reaction)}</td>
            <td style="text-align:right">${h.best_combo > 0 ? `×${h.best_combo}` : '—'}</td>
            <td style="text-align:right;color:var(--dim)">${dur}</td>
            <td style="text-align:right;color:var(--dim)">${fmt(h.played_at)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  requestAnimationFrame(() => renderHistoryChart(filtered));
}

function _historySetFilter(cat) {
  _historyFilter = cat;
  if (_historyData && _historyData.length) _renderHistoryUI(_historyData);
}
window._historySetFilter = _historySetFilter;

function renderHistoryChart(history) {
  const canvas = document.getElementById('ch-history-chart');
  if (!canvas || !window.Chart) return;
  if (window._historyChart) { window._historyChart.destroy(); window._historyChart = null; }
  if (!history.length) return;
  const palette = ['#ff4655','#4ade80','#60a5fa','#fbbf24','#c084fc','#f87171','#34d399','#818cf8','#fb923c','#a3e635'];
  const modes = [...new Set(history.map(h => h.mode))];
  const modeColor = {};
  modes.forEach((m, i) => modeColor[m] = palette[i % palette.length]);
  const sorted = [...history].reverse();
  window._historyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(h => new Date(h.played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})),
      datasets: [{ data: sorted.map(h => h.score), backgroundColor: sorted.map(h => modeColor[h.mode]+'bb'), borderColor: sorted.map(h => modeColor[h.mode]), borderWidth:1, borderRadius:3 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ display:false }, tooltip:{ callbacks:{
        title: (items) => { const h=sorted[items[0].dataIndex]; return `${new Date(h.played_at).toLocaleDateString('fr-FR')} — ${h.mode.replace(/_/g,' ')}`; },
        label: (item) => ` Score : ${item.raw.toLocaleString()}`
      }}},
      scales: {
        x: { ticks:{ color:'#8b949e', font:{ size:10 }, maxRotation:45 }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y: { ticks:{ color:'#8b949e' }, grid:{ color:'rgba(255,255,255,0.04)' }, beginAtZero:true }
      }
    }
  });
}

// ============ COACH IA (plan hebdomadaire) ============

function initAiCoachTab() {
  // Ne recharge pas si le résultat de la semaine courante est déjà affiché
  const result = document.getElementById('ai-coach-result');
  if (result && result.style.display !== 'none') return;
  loadAiCoach();
}

async function loadAiCoach() {
  const idle    = document.getElementById('ai-coach-idle');
  const loading = document.getElementById('ai-coach-loading');
  const result  = document.getElementById('ai-coach-result');
  if (!idle || !loading || !result) return;

  if (!coachingToken) {
    _aicShowIdle('Connecte-toi pour accéder au Coach IA.', false);
    return;
  }

  idle.style.display = 'none';
  loading.style.display = '';
  result.style.display = 'none';

  try {
    // GET : plan de la semaine courante (ou null si pas encore généré)
    const res = await fetch(`${API_BASE}/ai-coach`, {
      headers: { 'Authorization': 'Bearer ' + coachingToken }
    });
    const d = await res.json();
    loading.style.display = 'none';

    if (d.error) { _aicShowIdle('⚠ ' + d.error, false); return; }

    if (!d.analysis) {
      // Pas encore de plan cette semaine → état idle avec CTA
      _aicShowIdle(null, true, d.week_label, d.days_until_next);
    } else {
      result.style.display = '';
      _renderAiCoach(d.analysis, d.generated_at, d.week_label, d.week_start, d.days_until_next);
      // Charger l'historique en parallèle
      _aicLoadHistory();
    }
  } catch(e) {
    loading.style.display = 'none';
    _aicShowIdle('⚠ Erreur de connexion.', false);
  }
}

async function generateWeeklyPlan() {
  const idle    = document.getElementById('ai-coach-idle');
  const loading = document.getElementById('ai-coach-loading');
  const result  = document.getElementById('ai-coach-result');
  if (!idle || !loading || !result || !coachingToken) return;

  idle.style.display = 'none';
  loading.style.display = '';
  result.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/ai-coach`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + coachingToken, 'Content-Type': 'application/json' }
    });
    const d = await res.json();
    loading.style.display = 'none';

    if (res.status === 409) {
      // Plan déjà généré cette semaine (race condition)
      loadAiCoach();
      return;
    }
    if (d.error) { _aicShowIdle('⚠ ' + d.error, false); return; }

    result.style.display = '';
    _renderAiCoach(d.analysis, d.generated_at, d.week_label, d.week_start, d.days_until_next);
    _aicLoadHistory();
  } catch(e) {
    loading.style.display = 'none';
    _aicShowIdle('⚠ Erreur de connexion.', false);
  }
}

function _aicShowIdle(errorMsg, canGenerate, weekLabel, daysLeft) {
  const idle    = document.getElementById('ai-coach-idle');
  const loading = document.getElementById('ai-coach-loading');
  const result  = document.getElementById('ai-coach-result');
  if (!idle) return;
  idle.style.display = '';
  if (loading) loading.style.display = 'none';
  if (result)  result.style.display  = 'none';

  // Met à jour le bouton generate et le message
  const btn = document.getElementById('aic-generate-btn');
  const msg = document.getElementById('aic-cooldown-msg');

  if (canGenerate) {
    if (btn) {
      btn.style.display = '';
      btn.innerHTML = icon('zap',16) + ' Générer le plan de la ' + san(weekLabel || 'cette semaine');
      btn.onclick = generateWeeklyPlan;
    }
    if (msg) msg.style.display = 'none';
  } else {
    if (btn) btn.style.display = 'none';
    if (msg) {
      msg.style.display = '';
      msg.textContent = errorMsg || '';
    }
  }
}

async function _aicLoadHistory() {
  const histEl = document.getElementById('aic-history');
  if (!histEl || !coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/ai-coach?view=history`, {
      headers: { 'Authorization': 'Bearer ' + coachingToken }
    });
    const d = await res.json();
    const rows = (d.history || []).slice(1); // exclure la semaine courante déjà affichée
    if (!rows.length) { histEl.style.display = 'none'; return; }
    histEl.style.display = '';
    histEl.innerHTML = `
      <div class="aic-card" style="margin-top:16px">
        <div class="aic-card-label">${icon('calendar',16)} Semaines précédentes</div>
        <div class="aic-history-list">
          ${rows.map(r => `
            <div class="aic-history-item">
              <div class="aic-history-week">${_aicWeekLabel(r.week_start)}</div>
              <div class="aic-history-titre">${san(r.titre || '—')}</div>
              <div class="aic-history-diag">${san((r.diagnostic || '').slice(0,120))}${(r.diagnostic||'').length>120?'…':''}</div>
            </div>`).join('')}
        </div>
      </div>`;
  } catch(e) {}
}

function _aicWeekLabel(iso) {
  if (!iso) return '';
  return 'Semaine du ' + new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', timeZone:'UTC' });
}

function _renderAiCoach(a, generatedAt, weekLabel, weekStart, daysLeft) {
  if (!a) return;

  // Badge semaine + countdown
  const weekBadge = document.getElementById('aic-week-badge');
  if (weekBadge) weekBadge.textContent = weekLabel || '';

  const countdown = document.getElementById('aic-countdown');
  if (countdown) {
    countdown.textContent = daysLeft !== undefined
      ? `Prochain plan dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
      : '';
  }

  // Titre
  const titreEl = document.getElementById('aic-titre');
  if (titreEl) titreEl.textContent = a.titre || 'Plan de la semaine';

  // Date génération
  const dateEl = document.getElementById('aic-date');
  if (dateEl) {
    const dt = new Date(generatedAt);
    dateEl.textContent = 'Généré le ' + dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) +
      ' à ' + dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }

  // Objectif de la semaine (nouveau champ)
  const objEl = document.getElementById('aic-objectif');
  if (objEl) {
    if (a.objectif_semaine) {
      objEl.textContent = a.objectif_semaine;
      objEl.parentElement.style.display = '';
    } else {
      objEl.parentElement.style.display = 'none';
    }
  }

  // Diagnostic
  const diagEl = document.getElementById('aic-diagnostic');
  if (diagEl) diagEl.textContent = a.diagnostic || '';

  // Forces
  const forcesEl = document.getElementById('aic-forces');
  if (forcesEl) forcesEl.innerHTML = (a.forces || []).map(f =>
    `<li class="aic-list-item aic-force-item">✓ ${san(f)}</li>`).join('');

  // Axes
  const axesEl = document.getElementById('aic-axes');
  if (axesEl) axesEl.innerHTML = (a.axes || []).map(ax =>
    `<li class="aic-list-item aic-axe-item">→ ${san(ax)}</li>`).join('');

  // Focus
  const focusEl = document.getElementById('aic-focus');
  if (focusEl) focusEl.textContent = a.focus || '';

  // Plan (4 scénarios pour la semaine)
  const planEl = document.getElementById('aic-plan');
  if (planEl) {
    planEl.innerHTML = (a.plan || []).map((s, i) => `
      <div class="aic-plan-item">
        <div class="aic-plan-num">${i + 1}</div>
        <div class="aic-plan-info">
          <div class="aic-plan-label">${san(s.label || s.key || '')}</div>
          <div class="aic-plan-conseil">${san(s.conseil || '')}</div>
        </div>
        <div class="aic-plan-reps">${s.reps || 1}×/sem</div>
        <button class="aic-plan-play" onclick="${s.key ? `(typeof G!=='undefined'&&(G.benchmarkMode=false,startGame('${s.key}')))` : ''}" title="Lancer">▶</button>
      </div>`).join('');
  }

  // Motivation
  const motivEl = document.getElementById('aic-motivation');
  if (motivEl) motivEl.textContent = a.motivation || '';
}

// ============ PROFILE ============

// ============ VALORANT TRACKER ============

// Agent icon URLs from valorant-api.com
const AGENT_ICONS = {};
(async function loadAgentIcons() {
  try {
    const r = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const d = await r.json();
    for (const a of d.data || []) AGENT_ICONS[a.displayName.toLowerCase()] = a.displayIcon;
  } catch(e) {}
})();

// Rank emblem URLs
function _rankEmblemUrl(rankStr) {
  if (!rankStr) return null;
  const tiers = {'iron':3,'bronze':6,'silver':9,'gold':12,'platinum':15,'diamond':18,'ascendant':21,'immortal':24,'radiant':27};
  const parts = rankStr.toLowerCase().split(' ');
  const base = parts[0];
  const num = parseInt(parts[1]) || 1;
  const tier = tiers[base];
  if (tier == null) return null;
  const id = base === 'radiant' ? 27 : tier + (num - 1);
  return `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${id}/smallicon.png`;
}

// ── Tracker state ─────────────────────────────────────────────────────
let _trackerMode      = 'competitive'; // current queue filter
let _trackerCtx       = 'self';        // 'self' | 'search'
let _trackerSearch    = null;          // { name, tag, region } for search context
let _trackerRawData   = null;          // full unfiltered data (self)
let _trackerSrchRaw   = null;          // full unfiltered data (search)

// Normalise Henrik's mode string to our filter key
function _normMode(str) {
  return (str || '').toLowerCase().replace(/[\s_\-]/g, '');
}

// Re-render from cached raw data using current mode filter (no API call)
function _trackerApplyFilter(rawData, wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap || !rawData) return;
  const all = rawData.recent_matches || [];
  const filtered = _trackerMode
    ? all.filter(m => _normMode(m.mode) === _trackerMode)
    : all;
  // Recompute stats from filtered matches
  let wins=0,losses=0,tK=0,tD=0,tA=0,tHS=0,tSh=0,tSc=0,tRd=0,tDmg=0,tDmgRcv=0;
  const agentMap={}, mapMap={};
  for (const m of filtered) {
    const isWin = m.result === 'WIN'; if(isWin) wins++; else losses++;
    tK+=m.kills||0; tD+=m.deaths||0; tA+=m.assists||0;
    const sh = m._shots||0; tHS+=m._hs||0; tSh+=sh;
    tSc+=m._score||0; tRd+=m._rounds||0; tDmg+=m._dmg||0; tDmgRcv+=m._dmgRcv||0;
    const ag=m.agent||'Unknown', mp=m.map||'Unknown';
    if(!agentMap[ag]) agentMap[ag]={games:0,wins:0,kills:0,deaths:0,score:0,rounds:0,hs:0,shots:0,kast:0,kastN:0};
    agentMap[ag].games++; if(isWin) agentMap[ag].wins++;
    agentMap[ag].kills+=m.kills||0; agentMap[ag].deaths+=m.deaths||0;
    agentMap[ag].score+=m._score||0; agentMap[ag].rounds+=m._rounds||0;
    agentMap[ag].hs+=m._hs||0; agentMap[ag].shots+=sh;
    if(m.kast!=null){agentMap[ag].kast+=m.kast; agentMap[ag].kastN++;}
    if(!mapMap[mp]) mapMap[mp]={games:0,wins:0};
    mapMap[mp].games++; if(isWin) mapMap[mp].wins++;
  }
  const n=wins+losses;
  const recomputed = {
    account: rawData.account,
    stats: {
      matches_analyzed: n, wins, losses,
      win_rate: n>0 ? Math.round(wins/n*100) : 0,
      kda: tD>0 ? parseFloat(((tK+tA*0.5)/tD).toFixed(2)) : tK,
      avg_acs: tRd>0 ? Math.round(tSc/tRd) : 0,
      avg_hs_pct: tSh>0 ? Math.round(tHS/tSh*100) : 0,
      avg_damage: tRd>0 ? Math.round(tDmg/tRd) : 0,
      avg_damage_received: tRd>0 ? Math.round(tDmgRcv/tRd) : 0,
    },
    top_agents: Object.entries(agentMap).map(([agent,d])=>({
      agent, games:d.games, wins:d.wins, kills:d.kills, deaths:d.deaths,
      avg_acs: d.rounds>0 ? Math.round(d.score/d.rounds) : null,
      avg_hs_pct: d.shots>0 ? Math.round(d.hs/d.shots*100) : null,
      avg_kast: d.kastN>0 ? Math.round(d.kast/d.kastN) : null,
    })).sort((a,b)=>b.games-a.games).slice(0,5),
    top_maps: Object.entries(mapMap).map(([map,d])=>({map,...d})).sort((a,b)=>b.games-a.games).slice(0,5),
    recent_matches: filtered,
  };
  trackerRender(recomputed, wrap);
}

window._trackerSetMode = function(mode) {
  _trackerMode = mode;
  document.querySelectorAll('.trk-qtab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (_trackerCtx === 'search') {
    _trackerApplyFilter(_trackerSrchRaw, 'trk-search-stats-wrap');
  } else {
    _trackerApplyFilter(_trackerRawData, 'trk-stats-wrap');
  }
};

function trackerTabLoad() {
  const main = document.getElementById('trk-main');
  if (!main) return;
  _trackerCtx = 'self';
  if (!coachingUser?.riot_gamename) {
    main.innerHTML = `
      <div class="trk-link-screen">
        <div class="trk-link-icon">${icon('gamepad',20)}</div>
        <div class="trk-link-title">Lie ton compte Riot Games</div>
        <p class="trk-link-desc">Connecte ton Riot ID pour accéder à tes stats Valorant en temps réel — Win Rate, KDA, ACS, headshot %, top agents et dernières parties ranked.</p>
        <div class="trk-link-form">
          <input id="trk-riot-input" type="text" class="trk-link-input" placeholder="Pseudo#TAG  (ex: TenZ#0505)" autocomplete="off">
          <button class="trk-link-btn" onclick="trackerLinkRiot()">Lier mon compte Riot</button>
          <div id="trk-link-msg" class="trk-link-msg"></div>
        </div>
      </div>`;
  } else {
    _trackerShowAccount();
  }
}

function _trackerShowAccount() {
  const main = document.getElementById('trk-main');
  if (!main) return;
  const u = coachingUser;
  const rankColor = _riotTierColor(u.riot_rank);
  const emblemUrl = _rankEmblemUrl(u.riot_rank);
  const syncDate = u.riot_rank_synced_at
    ? new Date(u.riot_rank_synced_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
    : null;
  main.innerHTML = `
    <div class="trk-hero">
      <div class="trk-hero-content">
        <div class="trk-hero-left">
          <div class="trk-rank-emblem">
            ${emblemUrl ? `<img src="${emblemUrl}" alt="">` : '<span class="trk-rank-emoji">'+icon('target',18)+'</span>'}
          </div>
          <div class="trk-hero-info">
            <div class="trk-hero-name">${san(u.riot_gamename)}<span class="trk-tag">#${san(u.riot_tagline)}</span></div>
            ${u.riot_rank
              ? `<div class="trk-hero-rank-text" style="color:${rankColor}">${san(u.riot_rank)}<span class="trk-hero-lp">${u.riot_lp != null ? u.riot_lp + ' RR' : ''}</span></div>`
              : '<div style="color:var(--dim);font-size:0.85rem;margin-top:4px">Rang non synchronisé</div>'}
            ${syncDate ? `<div class="trk-hero-sync">Sync ${syncDate}</div>` : ''}
          </div>
        </div>
        <div class="trk-hero-actions">
          <button class="trk-btn trk-btn-primary" onclick="trackerSyncRank(this)">${icon('refresh-cw',14)} Sync</button>
          <button class="trk-btn trk-btn-ghost" onclick="trackerUnlink()">Délier</button>
        </div>
      </div>
    </div>
    ${_trkQueueTabs()}
    <div id="trk-stats-wrap"></div>
    <div id="trk-msg" class="trk-link-msg"></div>`;
  trackerLoadStats();
}

function _trkQueueTabs() {
  const queues = [
    { mode:'competitive', label:'Competitive' },
    { mode:'unrated',     label:'Non-classé' },
    { mode:'spikerush',   label:'Spike Rush' },
    { mode:'deathmatch',  label:'Deathmatch' },
    { mode:'',            label:'Toutes' },
  ];
  return `<div class="trk-queue-tabs">${queues.map(q =>
    `<button class="trk-qtab${_trackerMode===q.mode?' active':''}" data-mode="${q.mode}" onclick="_trackerSetMode('${q.mode}')">${q.label}</button>`
  ).join('')}</div>`;
}

async function trackerLinkRiot() {
  const input = document.getElementById('trk-riot-input');
  const msg   = document.getElementById('trk-link-msg');
  if (!input) return;
  const riot_id = input.value.trim();
  if (!riot_id) { if(msg){msg.textContent='Entre ton Riot ID';msg.style.color='#ff4655';} return; }
  if (msg) { msg.textContent = 'Recherche en cours…'; msg.style.color = 'var(--dim)'; }
  try {
    const res  = await fetch(`${API_BASE}/profile`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${coachingToken}`},
      body: JSON.stringify({ action:'link-riot', riot_id })
    });
    const data = await res.json();
    if (!res.ok) { if(msg){msg.textContent=data.error;msg.style.color='#ff4655';} return; }
    coachingUser = { ...coachingUser, riot_gamename:data.riot.gamename, riot_tagline:data.riot.tagline,
      riot_rank:data.riot.rank, riot_lp:data.riot.lp, riot_region:data.riot.region, riot_rank_synced_at:new Date().toISOString() };
    _trackerShowAccount();
  } catch(e) { if(msg){msg.textContent='Erreur réseau';msg.style.color='#ff4655';} }
}

async function trackerSyncRank(btn) {
  const msg = document.getElementById('trk-msg');
  if (btn) btn.disabled = true;
  if (msg) { msg.textContent='Synchronisation…'; msg.style.color='var(--dim)'; }
  try {
    const res  = await fetch(`${API_BASE}/profile`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${coachingToken}`},
      body: JSON.stringify({ action:'sync-riot' })
    });
    const data = await res.json();
    if (!res.ok) { if(msg){msg.textContent=data.error;msg.style.color='#ff4655';} }
    else {
      coachingUser = { ...coachingUser, riot_rank:data.riot.rank, riot_lp:data.riot.lp, riot_rank_synced_at:new Date().toISOString() };
      _trackerShowAccount();
    }
  } catch(e) { if(msg){msg.textContent='Erreur réseau';msg.style.color='#ff4655';} }
  finally { if(btn) btn.disabled=false; }
}

async function trackerUnlink() {
  if (!confirm('Délier le compte Riot ?')) return;
  await fetch(`${API_BASE}/profile`, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${coachingToken}`},
    body: JSON.stringify({ action:'unlink-riot' })
  }).catch(()=>{});
  coachingUser = { ...coachingUser, riot_gamename:null, riot_tagline:null, riot_rank:null, riot_lp:null, riot_region:null, riot_rank_synced_at:null };
  trackerTabLoad();
}

async function trackerLoadStats(btn) {
  const wrap = document.getElementById('trk-stats-wrap');
  if (!wrap) return;
  if (btn) btn.disabled = true;
  wrap.innerHTML = `<div class="trk-loading">${icon('chart',20)} Chargement des stats…</div>`;
  try {
    const res  = await fetch(`${API_BASE}/profile?action=tracker`, { headers:{'Authorization':`Bearer ${coachingToken}`} });
    const data = await res.json();
    if (!res.ok) {
      wrap.innerHTML = `<div style="text-align:center;padding:24px 0">
        <p style="color:#ff4655;font-size:0.85rem;margin-bottom:12px">${san(data.error)}</p>
        <button class="trk-btn trk-btn-primary" onclick="trackerLoadStats(this)">Réessayer</button></div>`;
      return;
    }
    _trackerRawData = data;
    _trackerApplyFilter(_trackerRawData, 'trk-stats-wrap');
  } catch(e) {
    wrap.innerHTML = `<div style="text-align:center;padding:24px 0">
      <p style="color:#ff4655;font-size:0.85rem;margin-bottom:12px">Erreur réseau</p>
      <button class="trk-btn trk-btn-primary" onclick="trackerLoadStats(this)">Réessayer</button></div>`;
  }
  finally { if(btn) btn.disabled=false; }
}

function trackerLoad() { trackerLoadStats(); }

// ── Search any player ──────────────────────────────────────────────
async function trackerSearchPlayer() {
  const input = document.getElementById('trk-search-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) { showToast.warn('Entre un Riot ID (Pseudo#TAG)'); return; }
  const parts = raw.split('#');
  if (parts.length < 2 || !parts[1]) { showToast.warn('Format : Pseudo#TAG'); return; }
  const name = parts[0].trim(), tag = parts.slice(1).join('#').trim();
  const region = (document.getElementById('trk-region-select')?.value) || 'eu';

  const mainEl = document.getElementById('trk-main');
  const resultsEl = document.getElementById('trk-search-results');
  if (!resultsEl) return;

  // Store search state for mode switching
  _trackerCtx = 'search';
  _trackerSearch = { name, tag, region };

  // Hide own profile, show search results
  if (mainEl) mainEl.style.display = 'none';
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `<div class="trk-loading">${icon('search',20)} Recherche de <strong>${san(name)}#${san(tag)}</strong> sur <strong>${region.toUpperCase()}</strong>…</div>`;

  try {
    const res = await fetch(`${API_BASE}/profile?action=tracker-search&name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&region=${encodeURIComponent(region)}`);
    const data = await res.json();
    if (!res.ok) {
      resultsEl.innerHTML = `<div style="text-align:center;padding:32px 0">
        <p style="color:#ff4655;font-size:0.9rem;margin-bottom:14px">${san(data.error || 'Joueur introuvable')}</p>
        <button class="trk-btn trk-btn-ghost" onclick="trackerSearchBack()">← Retour</button></div>`;
      return;
    }
    _trackerSrchRaw = data;
    // Build search hero
    const acct = data.account || {};
    const rankColor = _riotTierColor(acct.rank);
    const emblemUrl = _rankEmblemUrl(acct.rank);
    resultsEl.innerHTML = `
      <div class="trk-hero trk-hero--search">
        <div class="trk-hero-content">
          <div class="trk-hero-left">
            <div class="trk-rank-emblem">
              ${emblemUrl ? `<img src="${emblemUrl}" alt="">` : '<span class="trk-rank-emoji">'+icon('target',18)+'</span>'}
            </div>
            <div class="trk-hero-info">
              <div class="trk-hero-name">${san(acct.gamename || name)}<span class="trk-tag">#${san(acct.tagline || tag)}</span></div>
              ${acct.rank
                ? `<div class="trk-hero-rank-text" style="color:${rankColor}">${san(acct.rank)}<span class="trk-hero-lp">${acct.lp != null ? acct.lp + ' RR' : ''}</span></div>`
                : '<div style="color:var(--dim);font-size:0.85rem;margin-top:4px">Rang non disponible</div>'}
            </div>
          </div>
          <div class="trk-hero-actions">
            <button class="trk-btn trk-btn-ghost" onclick="trackerSearchBack()">← Mon profil</button>
          </div>
        </div>
      </div>
      ${_trkQueueTabs()}
      <div id="trk-search-stats-wrap"></div>`;
    // Apply current filter and render
    _trackerApplyFilter(_trackerSrchRaw, 'trk-search-stats-wrap');
  } catch(e) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:32px 0">
      <p style="color:#ff4655;font-size:0.9rem;margin-bottom:14px">Erreur réseau</p>
      <button class="trk-btn trk-btn-ghost" onclick="trackerSearchBack()">← Retour</button></div>`;
  }
}

function trackerSearchBack() {
  const mainEl = document.getElementById('trk-main');
  const resultsEl = document.getElementById('trk-search-results');
  if (mainEl) mainEl.style.display = '';
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
  const input = document.getElementById('trk-search-input');
  if (input) input.value = '';
  _trackerCtx = 'self';
  _trackerSearch = null;
  _trackerSrchRaw = null;
  // Re-apply filter on self data (tabs active state stays)
  _trackerApplyFilter(_trackerRawData, 'trk-stats-wrap');
}

// Allow Enter key in search input
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('trk-search-input');
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') trackerSearchPlayer(); });
});

function _donutSvg(pct, color) {
  const r = 58, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return `<svg class="trk-donut-svg" viewBox="0 0 140 140" width="140" height="140">
    <circle class="trk-donut-bg" cx="70" cy="70" r="${r}"/>
    <circle class="trk-donut-fg" cx="70" cy="70" r="${r}" stroke="${color}"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
  </svg>`;
}

function _perfBar(val, max, color) {
  const pct = Math.min(100, Math.round((val / max) * 100));
  return `<div class="trk-perf-bar"><div class="trk-perf-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function trackerRender(data, el) {
  const s = data.stats || {};
  const matches = data.recent_matches || [];
  const agents  = data.top_agents || [];
  const maps    = data.top_maps   || [];

  // Colour helpers
  const clrWR  = v => v >= 50 ? '#4ade80' : '#f87171';
  const clrKD  = v => { const n = parseFloat(v); return n >= 1.5 ? '#4ade80' : n < 1.0 ? '#f87171' : 'var(--txt)'; };
  const clrRR  = v => v == null ? 'var(--dim)' : v > 0 ? '#4ade80' : '#f87171';
  const fmtKDA = (k, d, a) => `${k}/<span class="trk-d-dim">${d}</span>/${a}`;
  const fmtRR   = v => v == null ? null : `${v > 0 ? '+' : ''}${v} RR`;
  const relTime = iso => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso);
    const h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
    if (d >= 1) return d === 1 ? 'hier' : `il y a ${d}j`;
    if (h >= 1) return `il y a ${h}h`;
    return 'récemment';
  };
  const fmtMultikills = mk => {
    if (!mk) return '';
    const badges = [];
    if (mk.aces   > 0) badges.push(`<span class="trk-mk-badge trk-mk-ace">${mk.aces}×ACE</span>`);
    if (mk.fourK  > 0) badges.push(`<span class="trk-mk-badge trk-mk-4k">${mk.fourK}×4K</span>`);
    if (mk.threeK > 0) badges.push(`<span class="trk-mk-badge trk-mk-3k">${mk.threeK}×3K</span>`);
    if (mk.twoK   > 0) badges.push(`<span class="trk-mk-badge trk-mk-2k">${mk.twoK}×2K</span>`);
    return badges.join('');
  };

  // ── Stats overview strip ──────────────────────────────────────────
  const statsHtml = `
    <div class="trk-stats-strip">
      <div class="trk-stat-cell">
        <div class="trk-stat-big trk-stat-wr" style="color:${clrWR(s.win_rate)}">${s.win_rate ?? '—'}%</div>
        <div class="trk-stat-lbl">Win Rate</div>
        <div class="trk-stat-sub">${s.wins ?? 0}V · ${s.losses ?? 0}D</div>
      </div>
      <div class="trk-stat-cell">
        <div class="trk-stat-big">${s.kda ?? '—'}</div>
        <div class="trk-stat-lbl">K/D Ratio</div>
        <div class="trk-stat-sub">${s.matches_analyzed ?? 0} parties</div>
      </div>
      <div class="trk-stat-cell">
        <div class="trk-stat-big">${s.avg_acs ?? '—'}</div>
        <div class="trk-stat-lbl">ACS moyen</div>
        <div class="trk-stat-sub">combat score</div>
      </div>
      <div class="trk-stat-cell">
        <div class="trk-stat-big">${s.avg_hs_pct != null ? s.avg_hs_pct + '%' : '—'}</div>
        <div class="trk-stat-lbl">HS%</div>
        <div class="trk-stat-sub">précision tête</div>
      </div>
      <div class="trk-stat-cell">
        <div class="trk-stat-big">${s.avg_damage ?? '—'}</div>
        <div class="trk-stat-lbl">Dégâts/Round</div>
        <div class="trk-stat-sub">${s.avg_damage_received ? `reçus: ${s.avg_damage_received}` : 'impact'}</div>
      </div>
    </div>`;

  // ── Per-agent table ───────────────────────────────────────────────
  const agentTableHtml = agents.length ? `
    <div class="trk-section">
      <div class="trk-section-title">${icon('user',14)} Agents</div>
      <table class="trk-agent-table">
        <thead><tr>
          <th>Agent</th><th>Picks</th><th>Win%</th><th>K/D</th><th>ACS</th><th>HS%</th><th>KAST</th>
        </tr></thead>
        <tbody>${agents.map(a => {
          const wr = a.games > 0 ? Math.round(a.wins / a.games * 100) : 0;
          const agIcon = AGENT_ICONS[(a.agent||'').toLowerCase()];
          const kd = a.deaths > 0 ? ((a.kills||0) / a.deaths).toFixed(2) : (a.kills||0);
          return `<tr>
            <td class="trk-agent-name-cell">
              ${agIcon ? `<img src="${agIcon}" class="trk-agent-thumb" alt="">` : ''}
              <span>${san(a.agent)}</span>
            </td>
            <td class="trk-td-dim">${a.games}</td>
            <td class="trk-td-wr" style="color:${clrWR(wr)}">${wr}%</td>
            <td style="color:${clrKD(kd)}">${kd}</td>
            <td>${a.avg_acs ?? '—'}</td>
            <td class="trk-td-sec">${a.avg_hs_pct != null ? a.avg_hs_pct+'%' : '—'}</td>
            <td class="trk-td-sec">${a.avg_kast != null ? a.avg_kast+'%' : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '';

  // ── Per-map table ─────────────────────────────────────────────────
  const mapTableHtml = maps.length ? `
    <div class="trk-section">
      <div class="trk-section-title">${icon('map',14)} Maps</div>
      <table class="trk-agent-table">
        <thead><tr>
          <th>Map</th><th>Picks</th><th>Win%</th><th>Victoires</th>
        </tr></thead>
        <tbody>${maps.map(m => {
          const wr = m.games > 0 ? Math.round(m.wins / m.games * 100) : 0;
          const bar = `<div class="trk-mini-bar"><div style="width:${wr}%;background:${clrWR(wr)};height:100%;border-radius:2px"></div></div>`;
          return `<tr>
            <td class="trk-td-name">${san(m.map)}</td>
            <td class="trk-td-dim">${m.games}</td>
            <td class="trk-td-wr" style="color:${clrWR(wr)}">${wr}%</td>
            <td>${bar}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '';

  // ── Match history cards ───────────────────────────────────────────
  const matchCardsHtml = matches.length ? matches.map(m => {
    const isWin   = m.result === 'WIN';
    const agIcon  = AGENT_ICONS[(m.agent||'').toLowerCase()];
    const kd      = m.deaths > 0 ? (m.kills / m.deaths).toFixed(2) : m.kills;
    const rrStr   = fmtRR(m.rr_change);
    const mkHtml  = fmtMultikills(m.multikills);
    const modeLabel = m.mode || 'Competitive';
    const clickable = m.match_id ? `onclick="_trkOpenMatch('${san(m.match_id)}')" style="cursor:pointer"` : '';
    return `<div class="trk-card ${isWin ? 'trk-card-win' : 'trk-card-loss'}" ${clickable}>
      <div class="trk-card-left">
        <div class="trk-card-agent">
          ${agIcon ? `<img src="${agIcon}" alt="${san(m.agent)}">` : `<div class="trk-card-agent-ph">${window.icon('user',18)}</div>`}
        </div>
        <div class="trk-card-info">
          <div class="trk-card-agent-name">${san(m.agent || '?')}${m.first_blood ? ' <span class="trk-fb-badge">FB</span>' : ''}</div>
          <div class="trk-card-meta">${san(modeLabel)} · ${san(m.map)}</div>
          <div class="trk-card-time">${relTime(m.date)}${mkHtml ? ' · '+mkHtml : ''}</div>
        </div>
      </div>
      <div class="trk-card-result ${isWin ? 'win' : 'loss'}">
        <div class="trk-card-result-label">${m.result}</div>
        <div class="trk-card-score">${san(m.score)}</div>
        ${rrStr ? `<div class="trk-card-rr" style="color:${clrRR(m.rr_change)}">${rrStr}</div>` : ''}
      </div>
      <div class="trk-card-stats">
        <div class="trk-card-stat">
          <div class="trk-card-stat-val">${fmtKDA(m.kills, m.deaths, m.assists)}</div>
          <div class="trk-card-stat-lbl">K / D / A</div>
        </div>
        <div class="trk-card-stat trk-card-stat-sec">
          <div class="trk-card-stat-val" style="color:${clrKD(kd)}">${kd}</div>
          <div class="trk-card-stat-lbl">K/D</div>
        </div>
        <div class="trk-card-stat">
          <div class="trk-card-stat-val">${m.acs ?? '—'}</div>
          <div class="trk-card-stat-lbl">ACS</div>
        </div>
        <div class="trk-card-stat trk-card-stat-sec">
          <div class="trk-card-stat-val">${m.hs_pct != null ? m.hs_pct+'%' : '—'}</div>
          <div class="trk-card-stat-lbl">HS%</div>
        </div>
        <div class="trk-card-stat trk-card-stat-sec">
          <div class="trk-card-stat-val">${m.damage ?? '—'}</div>
          <div class="trk-card-stat-lbl">D/R</div>
        </div>
        <div class="trk-card-stat trk-card-stat-sec">
          <div class="trk-card-stat-val">${m.kast != null ? m.kast+'%' : '—'}</div>
          <div class="trk-card-stat-lbl">KAST</div>
        </div>
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--dim);font-size:0.85rem;padding:24px 0;text-align:center">Aucune partie trouvée pour ce mode.</p>`;

  el.innerHTML = `
    ${statsHtml}
    <div class="trk-split">
      ${agentTableHtml}
      ${mapTableHtml}
    </div>
    <div class="trk-section">
      <div class="trk-section-title">${icon('trending',14)} Historique · ${s.matches_analyzed ?? matches.length} parties</div>
      <div class="trk-cards-list">${matchCardsHtml}</div>
    </div>
    <div class="trk-footer">Données via Henrik Dev API · Non-officiel</div>
  `;
}

// ── Match detail modal ────────────────────────────────────────────────
window._trkOpenMatch = async function(matchId) {
  // Create/reuse modal overlay
  let overlay = document.getElementById('trk-match-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'trk-match-overlay';
    overlay.className = 'trk-match-overlay';
    overlay.innerHTML = '<div class="trk-match-modal" id="trk-match-modal"></div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) _trkCloseMatch(); });
    document.body.appendChild(overlay);
  }
  const modal = document.getElementById('trk-match-modal');
  overlay.style.display = 'flex';
  modal.innerHTML = `<div class="trk-match-loading">${icon('chart',22)} Chargement du match…</div>`;

  try {
    const res = await fetch(`${API_BASE}/profile?action=tracker-match&matchId=${encodeURIComponent(matchId)}`);
    const data = await res.json();
    if (!res.ok) { modal.innerHTML = `<div class="trk-match-err">${san(data.error)}<br><button class="trk-btn trk-btn-ghost" style="margin-top:12px" onclick="_trkCloseMatch()">Fermer</button></div>`; return; }
    _trkRenderMatchModal(data, modal);
  } catch(e) {
    modal.innerHTML = `<div class="trk-match-err">Erreur réseau<br><button class="trk-btn trk-btn-ghost" style="margin-top:12px" onclick="_trkCloseMatch()">Fermer</button></div>`;
  }
};

window._trkCloseMatch = function() {
  const o = document.getElementById('trk-match-overlay');
  if (o) o.style.display = 'none';
};

document.addEventListener('keydown', e => { if (e.key === 'Escape') window._trkCloseMatch?.(); });

function _trkRenderMatchModal(d, modal) {
  // ── Colour helpers ────────────────────────────────────────────────
  const RANK_COLORS = {
    iron:'#a0836c', bronze:'#cd9a6a', silver:'#b0b8c1', gold:'#f5d269',
    platinum:'#4bc8d8', diamond:'#ae7fe8', ascendant:'#4ade80', immortal:'#f87171', radiant:'#ffe566',
  };
  const rankClr = r => { if (!r) return '#475569'; return RANK_COLORS[r.toLowerCase().split(' ')[0]] || '#475569'; };
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
  const fmtDur  = s => s >= 60 ? `${Math.floor(s/60)}m${String(s%60).padStart(2,'0')}s` : `${s}s`;

  const blue = d.blue || {}, red = d.red || {};
  const blueWon = !!blue.has_won, redWon = !!red.has_won;
  const rounds = d.round_summary || [];

  // ── Current player identifier ─────────────────────────────────────
  const myName = (_trackerCtx === 'search' && _trackerSearch)
    ? _trackerSearch.name?.toLowerCase()
    : (typeof coachingUser !== 'undefined' ? coachingUser?.riot_gamename?.toLowerCase() : null);

  // ── Max ACS in scoreboard (for performance bar) ───────────────────
  const allPlayers = d.scoreboard || [];
  const maxACS = Math.max(1, ...allPlayers.map(p => p.acs || 0));

  // ── Multi-kill badges ─────────────────────────────────────────────
  const mkBadges = mk => {
    if (!mk) return '';
    const b = [];
    if (mk.aces  > 0) b.push(`<span class="trk-mk-badge trk-mk-ace">${mk.aces}×ACE</span>`);
    if (mk.fourK > 0) b.push(`<span class="trk-mk-badge trk-mk-4k">${mk.fourK}×4K</span>`);
    if (mk.threeK> 0) b.push(`<span class="trk-mk-badge trk-mk-3k">${mk.threeK}×3K</span>`);
    if (mk.twoK  > 0) b.push(`<span class="trk-mk-badge trk-mk-2k">${mk.twoK}×2K</span>`);
    return b.join('');
  };

  // ── Player row ────────────────────────────────────────────────────
  const playerRow = (p, teamClr) => {
    const isMe = p.name?.toLowerCase() === myName;
    const agIcon = AGENT_ICONS[(p.agent||'').toLowerCase()];
    const kd = typeof p.kd === 'number' ? p.kd.toFixed(2) : (p.kd ?? '—');
    const acsBarW = Math.round((p.acs || 0) / maxACS * 100);
    return `<tr class="trk-sb-row${isMe ? ' trk-sb-me' : ''}" style="${isMe ? `--team-clr:${teamClr}` : ''}">
      <td class="trk-sb-player-cell">
        <div class="trk-sb-agent-wrap">
          ${agIcon ? `<img class="trk-sb-agent-img" src="${agIcon}" alt="">` : `<div class="trk-sb-agent-ph"></div>`}
        </div>
        <div class="trk-sb-pinfo">
          <div class="trk-sb-name">${san(p.name)}<span class="trk-sb-tag">#${san(p.tag)}</span>${p.first_blood ? ' <span class="trk-fb-badge">FB</span>' : ''}</div>
          <div class="trk-sb-rank" style="color:${rankClr(p.rank)}">${san(p.rank||'Unranked')} · Niv.${p.level||'?'}</div>
        </div>
      </td>
      <td class="trk-sb-acs-cell">
        <div class="trk-sb-acs-val">${p.acs ?? '—'}</div>
        <div class="trk-sb-acs-bar"><div style="width:${acsBarW}%"></div></div>
      </td>
      <td class="trk-sb-num trk-sb-k">${p.kills ?? '—'}</td>
      <td class="trk-sb-num trk-sb-d">${p.deaths ?? '—'}</td>
      <td class="trk-sb-num trk-sb-a">${p.assists ?? '—'}</td>
      <td class="trk-sb-num trk-sb-sec">${kd}</td>
      <td class="trk-sb-num trk-sb-sec">${p.hs_pct != null ? p.hs_pct+'%' : '—'}</td>
      <td class="trk-sb-num trk-sb-sec">${p.damage ?? '—'}</td>
      <td class="trk-sb-num trk-sb-sec">${p.kast != null ? p.kast+'%' : '—'}</td>
      <td class="trk-sb-mk-cell">${mkBadges(p.multikills)}</td>
    </tr>`;
  };

  // ── Team section ──────────────────────────────────────────────────
  const teamSection = (players, won, roundsWon, teamClr, teamLabel) => `
    <div class="trk-sb-section" style="--team-clr:${teamClr}">
      <div class="trk-sb-section-hdr">
        <div class="trk-sb-section-dot" style="background:${teamClr}"></div>
        <span class="trk-sb-section-label">${teamLabel}</span>
        <span class="trk-sb-section-score">${roundsWon}</span>
        <span class="trk-sb-section-result ${won ? 'won' : 'lost'}">${won ? 'VICTOIRE' : 'DÉFAITE'}</span>
      </div>
      <table class="trk-sb-table">
        <thead><tr>
          <th class="trk-sb-th-player">Joueur</th>
          <th class="trk-sb-th-acs">ACS</th>
          <th class="trk-sb-th-num">K</th>
          <th class="trk-sb-th-num">D</th>
          <th class="trk-sb-th-num">A</th>
          <th class="trk-sb-th-num">KD</th>
          <th class="trk-sb-th-num">HS%</th>
          <th class="trk-sb-th-num">D/R</th>
          <th class="trk-sb-th-num">KAST</th>
          <th class="trk-sb-th-mk"></th>
        </tr></thead>
        <tbody>${players.map(p => playerRow(p, teamClr)).join('')}</tbody>
      </table>
    </div>`;

  // ── Round timeline ────────────────────────────────────────────────
  // Outcome icons (text, no emoji for cleaner look)
  const outcomeIcon = r => {
    if (r.end_type === 'Defused')   return '<span class="trk-rp-icon defuse">D</span>';
    if (r.end_type === 'Detonate')  return '<span class="trk-rp-icon detonate">X</span>';
    if (r.end_type === 'Eliminated') return '';
    if (r.plant)                    return '<span class="trk-rp-icon bomb">B</span>';
    return '<span class="trk-rp-icon time">T</span>';
  };
  const firstHalf  = rounds.filter(r => (r.round ?? 0) < 12);
  const secondHalf = rounds.filter(r => (r.round ?? 0) >= 12 && (r.round ?? 0) < 24);
  const overtime   = rounds.filter(r => (r.round ?? 0) >= 24);
  const renderHalf = (rds, label) => rds.length === 0 ? '' : `
    <div class="trk-rnd-half">
      <span class="trk-rnd-half-lbl">${label}</span>
      <div class="trk-rnd-pills">
        ${rds.map(r => {
          const wt = r.winning_team === 'blue' ? 'blue' : r.winning_team === 'red' ? 'red' : '';
          const site = r.plant?.site ? r.plant.site : '';
          return `<div class="trk-rp trk-rp-${wt}" title="R${(r.round??0)+1}${site?' · Site '+site:''} · ${r.end_type||''}">
            <span class="trk-rp-num">${(r.round??0)+1}</span>
            ${outcomeIcon(r)}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const roundTimeline = rounds.length ? `
    <div class="trk-rnd-timeline">
      ${renderHalf(firstHalf, 'Première mi-temps')}
      ${renderHalf(secondHalf, 'Deuxième mi-temps')}
      ${renderHalf(overtime, 'Prolongation')}
    </div>` : '';

  const blueTeam = allPlayers.filter(p => p.team === 'blue');
  const redTeam  = allPlayers.filter(p => p.team === 'red');

  modal.innerHTML = `
    <div class="trk-match-header">
      <div class="trk-match-header-info">
        <div class="trk-match-map-name">${san(d.map)}</div>
        <div class="trk-match-meta-row">
          <span>${san(d.mode)}</span>
          <span class="trk-meta-dot">·</span>
          <span>${fmtDate(d.date)}</span>
          ${d.duration ? `<span class="trk-meta-dot">·</span><span>${fmtDur(d.duration)}</span>` : ''}
        </div>
      </div>
      <div class="trk-match-header-score">
        <div class="trk-mhs-side ${blueWon ? 'won' : 'lost'}" style="--clr:#3b82f6">
          <span class="trk-mhs-num">${blue.rounds_won ?? 0}</span>
          <span class="trk-mhs-label">Bleu</span>
        </div>
        <div class="trk-mhs-divider">:</div>
        <div class="trk-mhs-side ${redWon ? 'won' : 'lost'}" style="--clr:#ef4444">
          <span class="trk-mhs-num">${red.rounds_won ?? 0}</span>
          <span class="trk-mhs-label">Rouge</span>
        </div>
      </div>
      <button class="trk-match-close" onclick="_trkCloseMatch()">✕</button>
    </div>
    ${roundTimeline}
    <div class="trk-match-body">
      ${teamSection(blueTeam, blueWon, blue.rounds_won ?? 0, '#3b82f6', 'Équipe Bleue')}
      ${teamSection(redTeam,  redWon,  red.rounds_won  ?? 0, '#ef4444', 'Équipe Rouge')}
    </div>`;
}

async function renderProfile() {
  // Immediate render from cached user data
  const u = typeof coachingUser !== 'undefined' ? coachingUser : null;
  const avatarEl  = document.getElementById('pf-avatar');
  const nameEl    = document.getElementById('pf-username');
  const roleEl    = document.getElementById('pf-role');
  if (avatarEl && u?.username) avatarEl.textContent = u.username[0].toUpperCase();
  if (nameEl   && u?.username) nameEl.textContent   = u.username;
  if (roleEl) roleEl.innerHTML = u?.role === 'coach' ? icon('graduation-cap',14)+' Coach' : u?.role === 'admin' ? icon('settings',14)+' Admin' : icon('gamepad',14)+' Joueur';

  // Benchmark from localStorage (medium tier)
  _pfRenderBench();
  _pfRenderRadar();
  _pfRenderTrophies();

  // Fetch rich stats
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/coaching?view=player-profile`, {
      headers: { 'Authorization': 'Bearer ' + coachingToken }
    });
    const d = await res.json();

    // Stats row
    const s = d.stats || {};
    _pfSet('pf-games',  s.total_games?.toLocaleString() || '0');
    _pfSet('pf-best',   s.best_score  ? Number(s.best_score).toLocaleString()  : '—');
    _pfSet('pf-avg',    s.avg_score   ? Number(s.avg_score).toLocaleString()   : '—');
    _pfSet('pf-acc',    s.avg_accuracy != null ? s.avg_accuracy + '%' : '—');
    _pfSet('pf-streak', s.streak != null ? s.streak + (s.streak === 1 ? ' j' : ' j') : '—');

    // Global rank
    if (s.rank) {
      const rkWrap = document.getElementById('pf-global-rank');
      if (rkWrap) rkWrap.style.display = '';
      _pfSet('pf-rank-num', '#' + s.rank);
    }

    // Activity 30j chart
    _pfRenderActivityChart(d.activity_30 || []);

    // Recent games
    _pfRenderRecentGames(d.recent_games || []);

    // Mode breakdown
    _pfRenderModeBreakdown(d.mode_breakdown || []);

  } catch(e) {
    console.warn('Profile load error', e);
  }
}

function _pfSet(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Skill Radar Chart (6 axes) ──
let _pfRadarChart = null;
function _pfRenderRadar() {
  const canvas = document.getElementById('pf-radar-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Compute axes from localStorage run history + achievement stats
  const stats = loadAchievementStats();
  const SCENARIOS_LOCAL = typeof SCENARIOS !== 'undefined' ? SCENARIOS : {};

  // Precision: best accuracy
  const precision = Math.min(stats.bestAccuracy || 0, 100);
  // Speed: map best reaction (300→0, 150→100)
  const speed = stats.bestReaction > 0 ? Math.round(Math.max(0, Math.min(100, (300 - stats.bestReaction) / 1.5))) : 0;
  // Consistency: best combo scaled (0→0, 50→100)
  const consistency = Math.round(Math.min((stats.bestCombo || 0) / 50 * 100, 100));
  // Tracking: count tracking scenarios with >=1 thread (medium tier)
  let trackTotal = 0, trackDone = 0;
  try {
    const bench = JSON.parse(localStorage.getItem('visc_bench_medium') || '{}');
    Object.entries(SCENARIOS_LOCAL).forEach(([k, v]) => {
      if (v.type === 'track' || v.type === 'track_pct') {
        trackTotal++;
        if (bench[k] && v.th && bench[k] >= v.th[0]) trackDone++;
      }
    });
  } catch {}
  const tracking = trackTotal > 0 ? Math.round(trackDone / trackTotal * 100) : 0;
  // Clicking: same for click scenarios
  let clickTotal = 0, clickDone = 0;
  try {
    const bench = JSON.parse(localStorage.getItem('visc_bench_medium') || '{}');
    Object.entries(SCENARIOS_LOCAL).forEach(([k, v]) => {
      if (v.type === 'click') {
        clickTotal++;
        if (bench[k] && v.th && bench[k] >= v.th[0]) clickDone++;
      }
    });
  } catch {}
  const clicking = clickTotal > 0 ? Math.round(clickDone / clickTotal * 100) : 0;
  // Endurance: total games scaled (0→0, 100→100)
  const endurance = Math.round(Math.min((stats.totalGames || 0) / 100 * 100, 100));

  const data = [precision, speed, consistency, tracking, clicking, endurance];
  const labels = ['Précision', 'Vitesse', 'Régularité', 'Tracking', 'Clicking', 'Endurance'];

  if (_pfRadarChart) { _pfRadarChart.destroy(); _pfRadarChart = null; }

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#ff4655';

  _pfRadarChart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: accent + '33',
        borderColor: accent,
        borderWidth: 2,
        pointBackgroundColor: accent,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: css.getPropertyValue('--dim').trim() || '#8b949e', font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}

// ── Trophy Showcase ──
function _pfRenderTrophies() {
  const grid = document.getElementById('pf-trophy-grid');
  const countEl = document.getElementById('pf-trophy-count');
  if (!grid) return;
  const unlocked = getUnlocked();
  const total = ACHIEVEMENTS.length;
  if (countEl) countEl.textContent = `(${unlocked.length}/${total})`;

  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    return `<div class="pf-trophy ${done ? '' : 'pf-trophy-locked'}" title="${san(a.desc)}">
      <div class="pf-trophy-icon">${done ? a.icon : icon('lock',20)}</div>
      <div class="pf-trophy-name">${san(a.name)}</div>
    </div>`;
  }).join('');
}

function _pfRenderBench() {
  // Read from localStorage — medium tier
  const TNAMES = ['Unranked','Iron','Bronze','Silver','Gold','Platinum','Diamond','Legendary','Mythic'];
  const TCOLORS = ['#7c8389','#b97450','#c0c0c0','#e8c56d','#59c5c7','#d882f5','#2dbe73','#ff4655','#ff4655'];
  try {
    const bench = JSON.parse(localStorage.getItem('visc_bench_medium') || '{}');
    const SCENARIOS_LOCAL = typeof SCENARIOS !== 'undefined' ? SCENARIOS : {};
    let total = 0, maxTotal = 0;
    Object.entries(SCENARIOS_LOCAL).forEach(([k, v]) => {
      if (!v.th) return;
      const best = bench[k] || 0;
      const th = v.th || [];
      const threads = th.filter(t => best >= t).length;
      total += threads;
      maxTotal += 8;
    });
    const energy = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0;
    const rankIdx = Math.min(Math.floor(total / maxTotal * 8), 8);
    const rankName = TNAMES[rankIdx] || 'Unranked';
    const rankColor = TCOLORS[rankIdx] || '#7c8389';

    _pfSet('pf-bench-threads', total + ' / ' + maxTotal);
    _pfSet('pf-bench-energy',  energy + '%');
    const rankEl = document.getElementById('pf-bench-rank');
    if (rankEl) { rankEl.textContent = rankName; rankEl.style.color = rankColor; rankEl.style.borderColor = rankColor + '55'; rankEl.style.background = rankColor + '18'; }
  } catch(e) {}
}

let _pfActivityChart = null;
function _pfRenderActivityChart(activity30) {
  const canvas = document.getElementById('pf-activity-chart');
  if (!canvas) return;

  // Build a 30-day label array
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const map = {};
  activity30.forEach(r => { map[r.day] = r.games; });
  const values = days.map(d => map[d] || 0);

  const total = values.reduce((a, b) => a + b, 0);
  const totalEl = document.getElementById('pf-activity-total');
  if (totalEl) totalEl.textContent = total > 0 ? `· ${total} parties` : '';

  const labels = days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  });

  if (typeof Chart === 'undefined') return;
  if (_pfActivityChart) { _pfActivityChart.destroy(); _pfActivityChart = null; }

  _pfActivityChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map(v => v > 0 ? 'rgba(255,70,85,0.7)' : 'rgba(255,255,255,0.05)'),
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ctx.parsed.y + ' partie' + (ctx.parsed.y !== 1 ? 's' : '') }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxRotation: 0,
          callback: function(val, idx) { return idx % 5 === 0 ? this.getLabelForValue(val) : ''; }
        }},
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}

function _pfRenderRecentGames(games) {
  const el = document.getElementById('pf-recent-games');
  if (!el) return;
  if (!games.length) { el.innerHTML = '<p class="ch-empty" style="font-size:0.82rem">Aucune partie jouée.</p>'; return; }
  const SCENARIOS_LOCAL = typeof SCENARIOS !== 'undefined' ? SCENARIOS : {};
  el.innerHTML = games.map(g => {
    const label = SCENARIOS_LOCAL[g.mode]?.label || g.mode.replace(/_/g, ' ');
    const date = new Date(g.played_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const accColor = g.accuracy >= 80 ? '#4ade80' : g.accuracy >= 60 ? '#facc15' : '#f87171';
    return `<div class="pf-recent-row">
      <div class="pf-recent-mode">${san(label)}</div>
      <div class="pf-recent-stats">
        <span class="pf-recent-score">${Number(g.score).toLocaleString()}</span>
        <span class="pf-recent-acc" style="color:${accColor}">${g.accuracy}%</span>
        <span class="pf-recent-date">${date}</span>
      </div>
    </div>`;
  }).join('');
}

function _pfRenderModeBreakdown(modes) {
  const el = document.getElementById('pf-mode-breakdown');
  if (!el) return;
  if (!modes.length) { el.innerHTML = '<p class="ch-empty" style="font-size:0.82rem">Aucune donnée.</p>'; return; }
  const SCENARIOS_LOCAL = typeof SCENARIOS !== 'undefined' ? SCENARIOS : {};
  el.innerHTML = modes.slice(0, 8).map(m => {
    const label = SCENARIOS_LOCAL[m.mode]?.label || m.mode.replace(/_/g, ' ');
    return `<div class="pf-mode-row">
      <div class="pf-mode-name">${san(label)}</div>
      <div class="pf-mode-stats">
        <span class="pf-mode-score">${Number(m.best_score).toLocaleString()}</span>
        <span class="pf-mode-plays" style="color:var(--dim)">×${m.plays}</span>
      </div>
    </div>`;
  }).join('');
}

function pfToggleEdit() {
  const form = document.getElementById('pf-edit-form');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  if (!isOpen) {
    // Pré-remplir avec les valeurs actuelles
    const u = coachingUser;
    if (u) {
      const uInput = document.getElementById('pf-edit-username');
      const rInput = document.getElementById('pf-edit-rank');
      const oInput = document.getElementById('pf-edit-objective');
      if (uInput) uInput.value = u.username || '';
      if (rInput) rInput.value = u.current_rank || '';
      if (oInput) oInput.value = u.objective || '';
    }
    const msg = document.getElementById('pf-edit-msg');
    if (msg) msg.style.display = 'none';
  }
  form.style.display = isOpen ? 'none' : 'block';
}

async function pfSaveProfile() {
  const uInput = document.getElementById('pf-edit-username');
  const rInput = document.getElementById('pf-edit-rank');
  const oInput = document.getElementById('pf-edit-objective');
  const msgEl  = document.getElementById('pf-edit-msg');

  const username     = uInput?.value.trim();
  const current_rank = rInput?.value || null;
  const objective    = oInput?.value.trim() || null;

  if (!username || username.length < 3) {
    if (msgEl) { msgEl.textContent = 'Pseudo minimum 3 caractères'; msgEl.style.color = '#ff4655'; msgEl.style.display = 'inline'; }
    return;
  }

  const btn = document.querySelector('#pf-edit-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }

  try {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'update-profile', username, current_rank, objective })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');

    // Mettre à jour le cache local
    coachingUser = { ...coachingUser, ...data.user };
    showApp();
    renderProfile();
    pfToggleEdit();

    if (msgEl) { msgEl.textContent = '✓ Profil mis à jour'; msgEl.style.color = '#10b981'; msgEl.style.display = 'inline'; }
  } catch(e) {
    if (msgEl) { msgEl.textContent = e.message; msgEl.style.color = '#ff4655'; msgEl.style.display = 'inline'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
  }
}

function pfShareProfile() {
  const u = typeof coachingUser !== 'undefined' ? coachingUser : null;
  if (!u) return;
  const base = location.origin;
  const url = `${base}/profile.html?u=${encodeURIComponent(u.username)}`;
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('pf-share-copied');
    if (el) { el.style.display = 'inline'; setTimeout(() => el.style.display = 'none', 2500); }
  }).catch(() => {
    prompt('Copie ce lien :', url);
  });
}

// ============ NOTIFICATIONS ============

let _notifPollInterval = null;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

async function loadNotifications() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/profile?action=notifications`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) return;
    const d = await res.json();
    renderNotifBell(d.unread_count || 0);
    renderNotifList(d.notifications || []);
  } catch {}
}

function renderNotifBell(count) {
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  // Sidebar messages badge
  const navBadge = document.getElementById('nav-notif-badge');
  if (navBadge) {
    if (count > 0) { navBadge.textContent = count > 9 ? '9+' : String(count); navBadge.style.display = 'flex'; }
    else { navBadge.style.display = 'none'; }
  }
  // Coaching topbar bell badge
  const chBadge = document.getElementById('ch-notif-badge-btn');
  if (chBadge) {
    chBadge.textContent = count > 9 ? '9+' : String(count);
    chBadge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function renderNotifList(notifs) {
  const html = notifs.length
    ? notifs.map(n => `
        <div class="notif-item${n.is_read ? '' : ' notif-unread'}" onclick="clickNotif('${san(String(n.id))}','${san(n.tab || '')}')">
          <div class="notif-text">${san(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>`).join('')
    : '<p class="ch-empty" style="padding:16px;font-size:0.8rem">Aucune notification</p>';
  const el = document.getElementById('notif-list');
  if (el) el.innerHTML = html;
  const chEl = document.getElementById('ch-notif-list');
  if (chEl) chEl.innerHTML = html;
}

function toggleNotifPanel() {
  toggleCoachNotifPanel();
}

function toggleCoachNotifPanel() {
  const panel = document.getElementById('ch-notif-panel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) loadNotifications();
}

async function clickNotif(id, tab) {
  try {
    await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'mark-read', id })
    });
  } catch {}
  loadNotifications();
  if (tab) {
    const _np = document.getElementById('ch-notif-panel');
    if (_np) _np.style.display = 'none';
    coachingSwitchTab(tab);
  }
}

async function markAllNotifRead() {
  try {
    await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'mark-all-read' })
    });
  } catch {}
  loadNotifications();
}

// ============ MESSAGES TAB ============

let _activeRelId = null;
let _msgPollInterval = null;

function initMessagesTab() {
  const input = document.getElementById('msg-input');
  if (input && !input._keydownBound) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
    input._keydownBound = true;
  }
  loadConversations();
}

async function loadConversations() {
  const el = document.getElementById('msg-conversations');
  if (!el) return;
  try {
    const res = await fetch(`${API_BASE}/coaching?view=conversations`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) throw new Error();
    const d = await res.json();
    renderConversations(d.conversations || []);
  } catch {
    el.innerHTML = '<p class="ch-empty" style="padding:16px">Erreur de chargement</p>';
  }
}

function renderConversations(convs) {
  const el = document.getElementById('msg-conversations');
  if (!el) return;
  if (!convs.length) {
    el.innerHTML = '<p class="ch-empty" style="padding:16px;font-size:0.82rem">Aucune conversation</p>';
    return;
  }
  el.innerHTML = convs.map(c => {
    const name = san(c.other_username || '?');
    const unread = (c.unread || 0) > 0;
    const last = c.last_message ? san(c.last_message.substring(0, 40)) + (c.last_message.length > 40 ? '…' : '') : '<em style="color:var(--dim)">Aucun message</em>';
    return `<div class="msg-conv-item${_activeRelId == c.rel_id ? ' active' : ''}" onclick="openConversation(${c.rel_id},'${name}')">
      <div class="msg-conv-avatar">${name[0]?.toUpperCase() || '?'}</div>
      <div class="msg-conv-info">
        <div class="msg-conv-name">${name}${unread ? `<span class="msg-unread-badge">${c.unread}</span>` : ''}</div>
        <div class="msg-conv-last">${last}</div>
      </div>
    </div>`;
  }).join('');
}

async function openConversation(relId, name) {
  _activeRelId = relId;
  const header = document.getElementById('msg-chat-header');
  if (header) header.textContent = name;
  const input = document.getElementById('msg-input');
  if (input) input.disabled = false;
  // Refresh conversation list to clear unread badge
  loadConversations();
  await loadMessages();
  clearInterval(_msgPollInterval);
  _msgPollInterval = setInterval(loadMessages, 5000);
}

async function loadMessages() {
  if (!_activeRelId) return;
  try {
    const res = await fetch(`${API_BASE}/coaching?view=messages&rel_id=${_activeRelId}`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) return;
    const d = await res.json();
    renderMessages(d.messages || []);
  } catch {}
}

function renderMessages(msgs) {
  const el = document.getElementById('msg-chat-messages');
  if (!el) return;
  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  if (!msgs.length) {
    el.innerHTML = '<p class="ch-empty" style="padding:24px;text-align:center;font-size:0.82rem">Commencez la conversation !</p>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const mine = String(m.sender_id) === String(coachingUser?.id);
    return `<div class="msg-bubble ${mine ? 'msg-mine' : 'msg-theirs'}">
      ${!mine ? `<div class="msg-sender">${san(m.sender_username || '?')}</div>` : ''}
      <div class="msg-text">${san(m.content)}</div>
      <div class="msg-time">${timeAgo(m.created_at)}</div>
    </div>`;
  }).join('');
  if (wasAtBottom) el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  if (!_activeRelId) return;
  const input = document.getElementById('msg-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    const res = await fetch(`${API_BASE}/coaching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'send-message', rel_id: _activeRelId, content })
    });
    if (res.ok) loadMessages();
  } catch {}
}

// ============ RETOUR COACHING DEPUIS RÉSULTATS ============

window._coachLaunchSource = null;

const _COACH_LAUNCH_LABELS = {
  'ch-warmup':        icon('flame',16)+' Continuer le Warmup',
  'ch-scenarios':     icon('target',16)+' Retour aux Scénarios',
  'ch-cours':         icon('book',16)+' Retour au Cours',
  'ch-daily':         icon('zap',16)+' Retour au Daily',
  'ch-daily-training':icon('calendar',16)+' Retour au Daily Training',
  'ch-dashboard':     icon('home',16)+' Retour au Dashboard'
};

function _setCoachLaunchSource(tab) {
  window._coachLaunchSource = { tab };
}

function _updateCoachingReturnBtn() {
  const btn = document.getElementById('btn-back-coaching');
  if (!btn) return;
  const src = window._coachLaunchSource;
  if (!src) { btn.style.display = 'none'; return; }

  // Benchmark mode — hide the back button (benchmark manages its own flow)
  if (src.isBenchmark) { btn.style.display = 'none'; return; }

  // Routine guidée : afficher le prochain exercice
  if (src.routine) {
    const nextIdx = src.routineIdx + 1;
    const hasNext = nextIdx < src.routine.exercises.length;
    if (hasNext) {
      const nextEx = src.routine.exercises[nextIdx];
      btn.textContent = `▶ Exercice ${nextIdx + 1}/${src.routine.exercises.length} — ${nextEx.label}`;
      btn.style.display = '';
      btn.onclick = () => _launchRoutineExercise(src.routine, nextIdx);
    } else {
      // Routine terminée
      btn.textContent = '✅ Routine terminée — Retour au Warmup';
      btn.style.display = '';
      btn.onclick = () => {
        window._coachLaunchSource = null;
        btn.style.display = 'none';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('coaching-screen').classList.add('active');
        coachingSwitchTab('ch-warmup');
      };
    }
    return;
  }

  btn.innerHTML = _COACH_LAUNCH_LABELS[src.tab] || '← Retour au Coaching';
  btn.style.display = '';
  btn.onclick = () => {
    window._coachLaunchSource = null;
    btn.style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('coaching-screen').classList.add('active');
    coachingSwitchTab(src.tab);
  };
}

// ============ PERSONAL BESTS ============

let _pbHistory = null;
let _pbChart = null;

async function loadPbHistory() {
  if (!coachingToken || _pbHistory) { if (_pbHistory) _populatePbModeSelect(); return; }
  try {
    const res = await fetch(`${API_BASE}/coaching?view=pb-history`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) return;
    const d = await res.json();
    _pbHistory = d.pb_history || [];
    _populatePbModeSelect();
    renderPbAllBests();
  } catch {}
}

function _populatePbModeSelect() {
  const sel = document.getElementById('pb-mode-select');
  if (!sel || !_pbHistory) return;
  const modes = [...new Set(_pbHistory.map(r => r.mode))].sort();
  sel.innerHTML = '<option value="">— Choisir un mode —</option>' +
    modes.map(m => `<option value="${san(m)}">${san(m.replace(/_/g,' '))}</option>`).join('');
}

function renderPbChart() {
  const sel = document.getElementById('pb-mode-select');
  const wrap = document.getElementById('pb-chart-wrap');
  const canvas = document.getElementById('pb-chart');
  if (!sel || !wrap || !canvas || !_pbHistory) return;
  const mode = sel.value;
  if (!mode) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const rows = _pbHistory.filter(r => r.mode === mode).sort((a, b) => a.day.localeCompare(b.day));
  if (_pbChart) { _pbChart.destroy(); _pbChart = null; }
  if (!window.Chart || !rows.length) return;
  _pbChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: rows.map(r => new Date(r.day + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
      datasets: [{
        label: 'Meilleur score', data: rows.map(r => r.best),
        borderColor: '#ff4655', backgroundColor: 'rgba(255,70,85,0.08)',
        borderWidth: 2, pointBackgroundColor: '#ff4655', pointRadius: 4, fill: true, tension: 0.3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: item => ` Meilleur : ${item.raw.toLocaleString()}`
      }}},
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: false }
      }
    }
  });
}

function renderPbAllBests() {
  const el = document.getElementById('pb-all-bests');
  if (!el || !_pbHistory) return;
  const bests = {};
  _pbHistory.forEach(r => {
    if (!bests[r.mode] || r.best > bests[r.mode].best) bests[r.mode] = r;
  });
  const sorted = Object.entries(bests).sort((a, b) => a[0].localeCompare(b[0]));
  if (!sorted.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h4 style="font-size:0.78rem;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Records personnels</h4>
    <div class="pb-bests-grid">${sorted.map(([mode, r]) => `
      <div class="pb-best-card">
        <div class="pb-best-mode">${san(mode.replace(/_/g,' '))}</div>
        <div class="pb-best-score">${Number(r.best).toLocaleString()}</div>
        <div class="pb-best-date">${new Date(r.day + 'T00:00:00').toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'})}</div>
      </div>`).join('')}
    </div>`;
}

// ============ DAILY CHALLENGE ============

const DAILY_MODE_LABELS = {
  ground_plaza:'Ground Plaza Sparky', flicker_plaza:'Flicker Plaza rAim',
  air_pure:'Air Pure', pokeball_frenzy:'Pokeball Frenzy', pasu_reload:'Pasu Reload',
  vox_ts2:'voxTargetSwitch 2', ctrlsphere_aim:'Controlsphere rAim', air_voltaic:'Air Voltaic',
  beants:'BeanTS', floatts:'FloatTS Angelic', pasu_angelic:'Pasu Angelic',
  ctrlsphere_clk:'Controlsphere Click', whisphere:'Whisphere', smoothbot:'SmoothBot',
  vt_bounceshot:'VT Bounceshot', popcorn_mv:'Popcorn MV', vox_click:'voxTargetClick',
  waldots:'WaldoTS', polarized_hell:'Polarized Hell', pasu_perfected:'Pasu Perfected'
};

async function loadDailyChallenge() {
  if (!coachingToken) return;
  try {
    const res = await fetch(`${API_BASE}/coaching?view=daily-challenge`, {
      headers: { 'Authorization': `Bearer ${coachingToken}` }
    });
    if (!res.ok) return;
    const d = await res.json();
    renderDailyChallenge(d);
  } catch {}
}

function renderDailyChallenge(d) {
  const mode = d.daily_mode;
  const label = DAILY_MODE_LABELS[mode] || mode;

  const badge = document.getElementById('daily-mode-badge');
  if (badge) badge.textContent = label;

  const desc = document.getElementById('daily-mode-desc');
  if (desc) desc.innerHTML = `Mode du jour · <span style="color:var(--dim);font-size:0.82rem">${new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'2-digit',month:'long'})}</span>`;

  // User stats
  const userEl = document.getElementById('daily-user-stats');
  if (userEl) {
    if (d.user?.best_today) {
      userEl.innerHTML = `<span class="daily-stat">🏅 Ton meilleur aujourd'hui : <strong>${Number(d.user.best_today).toLocaleString()}</strong></span>
        <span class="daily-stat">Tentatives : <strong>${d.user.attempts}</strong></span>`;
    } else {
      userEl.innerHTML = `<span class="daily-stat" style="color:var(--dim)">Tu n'as pas encore joué le Daily aujourd'hui</span>`;
    }
  }

  // Play button
  const playBtn = document.getElementById('daily-play-btn');
  if (playBtn) {
    playBtn.disabled = false;
    playBtn.onclick = () => {
      _setCoachLaunchSource('ch-daily');
      
      coachingSwitchTab('hub-home');
      setTimeout(() => {
        const modeBtn = document.querySelector(`.mode-card[data-mode="${mode}"]`);
        if (modeBtn) modeBtn.click();
        else if (typeof startGame === 'function') startGame(mode);
      }, 100);
    };
  }

  // Countdown to midnight
  const countdownEl = document.getElementById('daily-countdown');
  if (countdownEl) {
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    countdownEl.textContent = `${h}h ${m}min`;
  }

  // Leaderboard
  renderDailyLeaderboard(d.leaderboard || []);
}

function renderDailyLeaderboard(board) {
  const el = document.getElementById('daily-leaderboard');
  if (!el) return;
  if (!board.length) { el.innerHTML = '<p class="ch-empty">Aucun score encore aujourd\'hui — sois le premier !</p>'; return; }
  const medals = [icon('medal',16), icon('medal',16), icon('medal',16)];
  el.innerHTML = `<table class="admin-table">
    <thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>Précision</th><th>Essais</th></tr></thead>
    <tbody>${board.map((r, i) => {
      const isMe = coachingUser && r.username === coachingUser.username;
      return `<tr${isMe ? ' style="background:rgba(255,70,85,0.07)"' : ''}>
        <td style="text-align:center">${medals[i] || `<span style="color:var(--dim)">${i+1}</span>`}</td>
        <td style="font-weight:600;color:${isMe?'var(--accent)':'var(--txt)'}">${san(r.username)}${isMe?' (moi)':''}</td>
        <td style="color:var(--accent);font-weight:700">${Number(r.score).toLocaleString()}</td>
        <td>${r.accuracy ?? '—'}%</td>
        <td style="color:var(--dim)">${r.attempts}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ============ LEADERBOARD ============

let _lbMode = 'gridshot';
const LB_MODES = [
  ['gridshot','Gridshot'],['pasu_reload','Pasu Reload'],['whisphere','Whisphere'],
  ['pokeball_frenzy','Pokeball Frenzy'],['flicker_plaza','Flicker Plaza'],
  ['ground_plaza','Ground Plaza'],['air_angelic','Air Angelic'],['speedflick','Speed Flick'],
  ['vox_ts2','VoxTS2'],['pasu_angelic','Pasu Angelic']
];

let _lbActiveTab = 'global';

function switchLbTab(tab) {
  _lbActiveTab = tab;
  document.getElementById('lb-section-global').style.display = tab === 'global' ? '' : 'none';
  document.getElementById('lb-section-mode').style.display   = tab === 'mode'   ? '' : 'none';
  document.getElementById('lb-tab-global').classList.toggle('active', tab === 'global');
  document.getElementById('lb-tab-mode').classList.toggle('active', tab === 'mode');
  if (tab === 'global') loadGlobalLeaderboard();
  else loadLeaderboard();
}

async function loadGlobalLeaderboard() {
  const el = document.getElementById('ch-lb-global');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty" style="padding:24px">Chargement…</p>';
  try {
    const res = await fetch(`${API_BASE}/coaching?view=global-leaderboard`);
    const { leaderboard } = await res.json();
    if (!leaderboard || !leaderboard.length) {
      el.innerHTML = '<p class="ch-empty">Aucun joueur dans le classement.</p>';
      return;
    }
    const medals = [icon('medal',16), icon('medal',16), icon('medal',16)];
    el.innerHTML = `<div style="overflow-x:auto"><table class="lb-table" style="width:100%">
      <thead><tr><th>#</th><th>Joueur</th><th>Score total</th><th>Parties</th><th>Préc. moy.</th><th>Meilleure partie</th></tr></thead>
      <tbody>${leaderboard.map((p, i) => {
        const isMe = typeof coachingUser !== 'undefined' && coachingUser && p.username === coachingUser.username;
        const medal = medals[i] || `<span style="color:var(--dim)">${i+1}</span>`;
        return `<tr class="lb-row ${i < 3 ? 'lb-top3' : ''} ${isMe ? 'lb-me' : ''}">
          <td class="lb-rank">${medal}</td>
          <td class="lb-name" style="${i===0?'color:var(--gold)':isMe?'color:var(--accent)':''}">${san(p.username)}${isMe ? ' <span style="font-size:0.72rem;opacity:0.7">(moi)</span>' : ''}</td>
          <td class="lb-score">${Number(p.total_score).toLocaleString()}</td>
          <td style="text-align:right;color:var(--dim)">${p.total_games}</td>
          <td style="text-align:right;color:${p.avg_accuracy>=80?'#4ade80':p.avg_accuracy>=60?'#facc15':'#f87171'}">${p.avg_accuracy}%</td>
          <td style="text-align:right;color:var(--accent)">${Number(p.best_game).toLocaleString()}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    el.innerHTML = `<p class="ch-empty">Erreur de chargement.</p>`;
  }
}

async function loadLeaderboard() {
  const el = document.getElementById('ch-lb-table');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="5" style="color:var(--dim);padding:20px;text-align:center">Chargement…</td></tr>';
  try {
    const r = await fetch(`${API_BASE}/coaching?view=leaderboard&mode=${_lbMode}`);
    const { rows } = await r.json();
    if (!rows || rows.length === 0) {
      el.innerHTML = '<tr><td colspan="5" style="color:var(--dim);padding:20px;text-align:center">Aucun score encore.</td></tr>';
      return;
    }
    el.innerHTML = rows.map((row, i) => {
      const medal = i === 0 ? icon('medal',16) : i === 1 ? icon('medal',16) : i === 2 ? icon('medal',16) : `${i+1}.`;
      const accColor = row.accuracy >= 80 ? '#4ade80' : row.accuracy >= 60 ? '#facc15' : '#f87171';
      return `<tr class="lb-row ${i < 3 ? 'lb-top3' : ''}">
        <td class="lb-rank">${medal}</td>
        <td class="lb-name">${san(row.username)}</td>
        <td class="lb-score">${Number(row.score).toLocaleString()}</td>
        <td class="lb-acc" style="color:${accColor}">${row.accuracy}%</td>
        <td class="lb-date" style="color:var(--dim)">${row.day}</td>
      </tr>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="5" style="color:var(--dim)">Erreur de chargement.</td></tr>';
  }
}

// ============ WEEKLY CHALLENGES ============
// Deterministic 3 challenges per ISO week, client-side, stored in localStorage.

const WEEKLY_CHALLENGE_POOL = [
  { type:'score',    target:5000,  mode:null,          icon:icon('target',20), title:'Score 5 000',           desc:'Atteindre 5 000 pts en une partie' },
  { type:'score',    target:8000,  mode:null,          icon:icon('flame',20), title:'Score 8 000',           desc:'Atteindre 8 000 pts en une partie' },
  { type:'acc',      target:90,    mode:null,          icon:icon('award',20), title:'90% Précision',         desc:'Finir avec 90%+ de précision' },
  { type:'acc',      target:95,    mode:null,          icon:icon('gem',20), title:'95% Précision',         desc:'Finir avec 95%+ de précision' },
  { type:'combo',    target:25,    mode:null,          icon:icon('waves',20), title:'Combo x25',             desc:'Atteindre un combo de 25' },
  { type:'combo',    target:40,    mode:null,          icon:icon('zap',20), title:'Combo x40',             desc:'Atteindre un combo de 40' },
  { type:'games',    target:5,     mode:null,          icon:icon('dumbbell',20), title:'5 Parties',              desc:'Jouer 5 parties cette semaine' },
  { type:'games',    target:15,    mode:null,          icon:icon('dumbbell',20), title:'15 Parties',             desc:'Jouer 15 parties cette semaine' },
  { type:'bench',    target:3,     mode:null,          icon:icon('chart',20), title:'3 Benchmarks',          desc:'Jouer 3 scénarios Viscose' },
  { type:'bench',    target:8,     mode:null,          icon:icon('trending-up',20), title:'8 Benchmarks',          desc:'Jouer 8 scénarios Viscose' },
  { type:'hits',     target:200,   mode:null,          icon:icon('crosshair',20), title:'200 Hits',              desc:'Cumuler 200 hits cette semaine' },
  { type:'hits',     target:500,   mode:null,          icon:icon('rocket',20), title:'500 Hits',              desc:'Cumuler 500 hits cette semaine' },
];

function _getISOWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
}
function _weekSeed() { const d = new Date(); return d.getFullYear() * 100 + _getISOWeek(); }

function getWeeklyChallenges() {
  const seed = _weekSeed();
  const stored = (() => { try { return JSON.parse(localStorage.getItem('weekly_challenges')); } catch { return null; } })();
  if (stored && stored.seed === seed) return stored;
  // Deterministic pick: use seed to shuffle and pick 3
  const pool = WEEKLY_CHALLENGE_POOL.slice();
  const rng = (s) => { s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s = Math.imul(s ^ (s >>> 13), 0x45d9f3b); return ((s ^ (s >>> 16)) >>> 0) / 4294967296; };
  let s = seed;
  for (let i = pool.length - 1; i > 0; i--) { s++; const j = Math.floor(rng(s) * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked = pool.slice(0, 3).map((c, i) => ({ ...c, id: `wk_${seed}_${i}`, progress: 0, done: false }));
  const data = { seed, challenges: picked };
  try { localStorage.setItem('weekly_challenges', JSON.stringify(data)); } catch {}
  return data;
}

function updateWeeklyChallenges(gameData) {
  const wk = getWeeklyChallenges();
  if (!wk || !gameData) return;
  let changed = false;
  wk.challenges.forEach(c => {
    if (c.done) return;
    let prev = c.progress;
    switch (c.type) {
      case 'score': if (gameData.score >= c.target) { c.progress = c.target; c.done = true; } break;
      case 'acc':   if (gameData.accuracy >= c.target) { c.progress = c.target; c.done = true; } break;
      case 'combo': if (gameData.bestCombo >= c.target) { c.progress = c.target; c.done = true; } break;
      case 'games': c.progress = Math.min((c.progress||0) + 1, c.target); if (c.progress >= c.target) c.done = true; break;
      case 'bench': if (gameData.isBenchmark) { c.progress = Math.min((c.progress||0) + 1, c.target); if (c.progress >= c.target) c.done = true; } break;
      case 'hits':  c.progress = Math.min((c.progress||0) + (gameData.hits||0), c.target); if (c.progress >= c.target) c.done = true; break;
    }
    if (c.progress !== prev) changed = true;
  });
  if (changed) {
    try { localStorage.setItem('weekly_challenges', JSON.stringify(wk)); } catch {}
    renderWeeklyChallenges();
    // Check if all 3 done
    if (wk.challenges.every(c => c.done)) {
      const stats = loadAchievementStats();
      stats.weeklyCompleted = (stats.weeklyCompleted || 0) + 1;
      saveAchievementStats(stats);
      if (window.showToast) window.showToast('Tous les défis de la semaine complétés ! 🎉', { type: 'success', duration: 4000 });
    }
  }
}

function renderWeeklyChallenges() {
  const el = document.getElementById('weekly-challenges-grid');
  if (!el) return;
  const wk = getWeeklyChallenges();
  if (!wk) { el.innerHTML = ''; return; }
  el.innerHTML = wk.challenges.map(c => {
    const pct = c.type === 'score' || c.type === 'acc' || c.type === 'combo'
      ? (c.done ? 100 : 0)
      : Math.round((c.progress || 0) / c.target * 100);
    const label = c.type === 'score' || c.type === 'acc' || c.type === 'combo'
      ? (c.done ? '✓ Complété' : 'En attente')
      : `${c.progress || 0} / ${c.target}`;
    return `<div class="weekly-card ${c.done ? 'wk-done' : ''}">
      <div class="wk-icon">${c.icon}</div>
      <div class="wk-title">${san(c.title)}</div>
      <div class="wk-desc">${san(c.desc)}</div>
      <div class="wk-prog-bar"><div class="wk-prog-fill ${c.done ? 'wk-complete' : ''}" style="width:${pct}%"></div></div>
      <div class="wk-prog-label">${label}</div>
    </div>`;
  }).join('');
}

// ============ ACHIEVEMENTS ============

const ACHIEVEMENTS = [
  // ─── GAMES PLAYED ───
  { id:'first_game',  icon:icon('target',20), name:'Premier Sang',       desc:'Joue ta première partie',         check: s => s.totalGames >= 1,                          progress: s => ({ cur: s.totalGames||0, max: 1 }) },
  { id:'ten_games',   icon:icon('flame',20), name:'Sur la lancée',       desc:'Joue 10 parties',                 check: s => s.totalGames >= 10,                         progress: s => ({ cur: Math.min(s.totalGames||0,10), max: 10 }) },
  { id:'fifty_games', icon:icon('dumbbell',20), name:'Assidu',              desc:'Joue 50 parties',                 check: s => s.totalGames >= 50,                         progress: s => ({ cur: Math.min(s.totalGames||0,50), max: 50 }) },
  { id:'hundred',     icon:icon('check-circle',20), name:'Centurion',           desc:'Joue 100 parties',                check: s => s.totalGames >= 100,                        progress: s => ({ cur: Math.min(s.totalGames||0,100), max: 100 }) },
  { id:'five_hundred',icon:icon('crown',20), name:'Vétéran',             desc:'Joue 500 parties',                check: s => s.totalGames >= 500,                        progress: s => ({ cur: Math.min(s.totalGames||0,500), max: 500 }) },
  // ─── ACCURACY ───
  { id:'acc80',       icon:icon('target',20), name:'Tireur Confirmé',    desc:'80%+ de précision en une partie', check: s => s.bestAccuracy >= 80,                       progress: s => ({ cur: Math.min(s.bestAccuracy||0,80), max: 80, unit:'%' }) },
  { id:'acc90',       icon:icon('award',20), name:'Tireur d\'Élite',   desc:'90%+ de précision en une partie', check: s => s.bestAccuracy >= 90,                       progress: s => ({ cur: Math.min(s.bestAccuracy||0,90), max: 90, unit:'%' }) },
  { id:'acc95',       icon:icon('zap',20), name:'Sniper Mode',         desc:'95%+ de précision en une partie', check: s => s.bestAccuracy >= 95,                       progress: s => ({ cur: Math.min(s.bestAccuracy||0,95), max: 95, unit:'%' }) },
  { id:'acc100',      icon:icon('gem',20), name:'Perfection',          desc:'100% de précision en une partie', check: s => s.bestAccuracy >= 100,                      progress: s => ({ cur: Math.min(s.bestAccuracy||0,100), max: 100, unit:'%' }) },
  // ─── COMBOS ───
  { id:'combo10',     icon:icon('link',20), name:'Enchaîneur',          desc:'Enchaîner x10 en une partie',     check: s => s.bestCombo >= 10,                          progress: s => ({ cur: Math.min(s.bestCombo||0,10), max: 10, unit:'x' }) },
  { id:'combo20',     icon:icon('waves',20), name:'Combo King',          desc:'Enchaîner x20 en une partie',     check: s => s.bestCombo >= 20,                          progress: s => ({ cur: Math.min(s.bestCombo||0,20), max: 20, unit:'x' }) },
  { id:'combo50',     icon:icon('wind',20), name:'Flow State',          desc:'Enchaîner x50 en une partie',     check: s => s.bestCombo >= 50,                          progress: s => ({ cur: Math.min(s.bestCombo||0,50), max: 50, unit:'x' }) },
  { id:'combo100',    icon:icon('zap',20), name:'Inarrêtable',         desc:'Enchaîner x100 en une partie',    check: s => s.bestCombo >= 100,                         progress: s => ({ cur: Math.min(s.bestCombo||0,100), max: 100, unit:'x' }) },
  // ─── SCORE ───
  { id:'score1k',     icon:icon('trending-up',20), name:'Décollage',           desc:'1 000+ points en une partie',     check: s => s.bestScore >= 1000,                        progress: s => ({ cur: Math.min(s.bestScore||0,1000), max: 1000, unit:' pts' }) },
  { id:'score5k',     icon:icon('star',20), name:'Pointeur',            desc:'5 000+ points en une partie',     check: s => s.bestScore >= 5000,                        progress: s => ({ cur: Math.min(s.bestScore||0,5000), max: 5000, unit:' pts' }) },
  { id:'score10k',    icon:icon('star',20), name:'Légende',             desc:'10 000+ points en une partie',    check: s => s.bestScore >= 10000,                       progress: s => ({ cur: Math.min(s.bestScore||0,10000), max: 10000, unit:' pts' }) },
  { id:'score20k',    icon:icon('sparkles',20), name:'Transcendant',        desc:'20 000+ points en une partie',    check: s => s.bestScore >= 20000,                       progress: s => ({ cur: Math.min(s.bestScore||0,20000), max: 20000, unit:' pts' }) },
  // ─── REACTION TIME ───
  { id:'react300',    icon:'⏱️', name:'Réflexes OK',         desc:'Réaction moyenne < 300ms',        check: s => s.bestReaction > 0 && s.bestReaction <= 300, progress: s => s.bestReaction > 0 ? { cur: Math.min(s.bestReaction,300), max: 300, invert:true, unit:'ms' } : { cur:0, max:300 } },
  { id:'react200',    icon:icon('zap',20), name:'Réflexes Vifs',       desc:'Réaction moyenne < 250ms',        check: s => s.bestReaction > 0 && s.bestReaction <= 250, progress: s => s.bestReaction > 0 ? { cur: Math.min(s.bestReaction,250), max: 250, invert:true, unit:'ms' } : { cur:0, max:250 } },
  { id:'react150',    icon:icon('rocket',20), name:'Flash',               desc:'Réaction moyenne < 150ms',        check: s => s.bestReaction > 0 && s.bestReaction <= 150, progress: s => s.bestReaction > 0 ? { cur: Math.min(s.bestReaction,150), max: 150, invert:true, unit:'ms' } : { cur:0, max:150 } },
  // ─── HITS ───
  { id:'hits500',     icon:icon('crosshair',20), name:'500 Balles',          desc:'500 hits cumulés',                check: s => s.totalHits >= 500,                         progress: s => ({ cur: Math.min(s.totalHits||0,500), max: 500 }) },
  { id:'hits2k',      icon:icon('rocket',20), name:'Artilleur',           desc:'2 000 hits cumulés',              check: s => s.totalHits >= 2000,                        progress: s => ({ cur: Math.min(s.totalHits||0,2000), max: 2000 }) },
  { id:'hits10k',     icon:icon('trophy',20), name:'Machine de Guerre',   desc:'10 000 hits cumulés',             check: s => s.totalHits >= 10000,                       progress: s => ({ cur: Math.min(s.totalHits||0,10000), max: 10000 }) },
  // ─── BENCHMARK ───
  { id:'bench1',      icon:icon('chart',20), name:'Premier Benchmark',   desc:'Jouer un scénario Viscose',       check: s => s.benchGames >= 1,                          progress: s => ({ cur: s.benchGames||0, max: 1 }) },
  { id:'bench10',     icon:icon('trending-up',20), name:'Grimpeur',            desc:'10 scénarios Viscose joués',      check: s => s.benchGames >= 10,                         progress: s => ({ cur: Math.min(s.benchGames||0,10), max: 10 }) },
  { id:'thread8',     icon:'🧵', name:'Thread Master',       desc:'Atteindre 8 threads sur un scénario',  check: s => s.maxThreads >= 8,                     progress: s => ({ cur: Math.min(s.maxThreads||0,8), max: 8 }) },
  { id:'thread6h',    icon:icon('gem',20), name:'Thread Master Hard',  desc:'Atteindre 6 threads Hard',        check: s => s.maxThreadsHard >= 6,                      progress: s => ({ cur: Math.min(s.maxThreadsHard||0,6), max: 6 }) },
  // ─── DAILY / STREAKS ───
  { id:'daily',       icon:icon('calendar',20), name:'Daily Warrior',       desc:'Jouer le Daily Challenge',        check: s => s.playedDaily,                              progress: s => ({ cur: s.playedDaily?1:0, max:1 }) },
  { id:'daily5',      icon:icon('calendar',20), name:'5 Dailies',           desc:'Compléter 5 Daily Challenges',    check: s => (s.dailyCount||0) >= 5,                     progress: s => ({ cur: Math.min(s.dailyCount||0,5), max:5 }) },
  { id:'routine',     icon:icon('dumbbell',20), name:'Routine Master',     desc:'Compléter une routine complète',  check: s => s.routineCompleted,                         progress: s => ({ cur: s.routineCompleted?1:0, max:1 }) },
  { id:'streak3',     icon:icon('flame',20), name:'3 jours de suite',    desc:'3 jours consécutifs de jeu',      check: s => s.streak >= 3,                              progress: s => ({ cur: Math.min(s.streak||0,3), max:3, unit:'j' }) },
  { id:'streak7',     icon:icon('key',20), name:'Hebdomadaire',        desc:'7 jours consécutifs de jeu',      check: s => s.streak >= 7,                              progress: s => ({ cur: Math.min(s.streak||0,7), max:7, unit:'j' }) },
  { id:'streak30',    icon:icon('crown',20), name:'Mois de Feu',         desc:'30 jours consécutifs de jeu',     check: s => s.streak >= 30,                             progress: s => ({ cur: Math.min(s.streak||0,30), max:30, unit:'j' }) },
  // ─── SPECIAL ───
  { id:'night_owl',   icon:icon('moon',20), name:'Oiseau de Nuit',     desc:'Jouer après minuit',              check: s => s.nightGames >= 1,                          progress: s => ({ cur: s.nightGames||0, max:1 }) },
  { id:'speed_demon', icon:icon('rocket',20), name:'Speed Demon',        desc:'Score > 3000 en 30s de jeu',      check: s => s.speedDemon,                               progress: s => ({ cur: s.speedDemon?1:0, max:1 }) },
];

function loadAchievementStats() {
  try { return JSON.parse(localStorage.getItem('ach_stats') || '{}'); } catch { return {}; }
}
function saveAchievementStats(data) {
  const existing = loadAchievementStats();
  localStorage.setItem('ach_stats', JSON.stringify({ ...existing, ...data }));
}
function getUnlocked() {
  try { return JSON.parse(localStorage.getItem('ach_unlocked') || '[]'); } catch { return []; }
}
function checkAndUnlockAchievements(gameData) {
  // Update stats
  const stats = loadAchievementStats();
  if (gameData) {
    stats.totalGames = (stats.totalGames || 0) + 1;
    stats.totalHits  = (stats.totalHits  || 0) + (gameData.hits || 0);
    stats.bestAccuracy = Math.max(stats.bestAccuracy || 0, gameData.accuracy || 0);
    stats.bestCombo = Math.max(stats.bestCombo || 0, gameData.bestCombo || 0);
    stats.bestScore = Math.max(stats.bestScore || 0, gameData.score || 0);
    if (gameData.avgReaction > 0) stats.bestReaction = stats.bestReaction > 0 ? Math.min(stats.bestReaction, gameData.avgReaction) : gameData.avgReaction;
    if (gameData.isDaily) { stats.playedDaily = true; stats.dailyCount = (stats.dailyCount || 0) + 1; }
    if (gameData.routineCompleted) stats.routineCompleted = true;
    if (gameData.isBenchmark) {
      stats.benchGames = (stats.benchGames || 0) + 1;
      if (gameData.threads) {
        stats.maxThreads = Math.max(stats.maxThreads || 0, gameData.threads);
        if (gameData.tier === 'hard') stats.maxThreadsHard = Math.max(stats.maxThreadsHard || 0, gameData.threads);
      }
    }
    // Night owl: game between 00:00 and 05:00
    const h = new Date().getHours();
    if (h >= 0 && h < 5) stats.nightGames = (stats.nightGames || 0) + 1;
    // Speed demon: >3000 pts in a 30s game
    if (gameData.score > 3000 && gameData.duration <= 30) stats.speedDemon = true;
  }
  saveAchievementStats(stats);

  const unlocked = getUnlocked();
  const newUnlocks = [];
  ACHIEVEMENTS.forEach(a => {
    if (!unlocked.includes(a.id) && a.check(stats)) {
      unlocked.push(a.id);
      newUnlocks.push(a);
    }
  });
  if (newUnlocks.length > 0) {
    localStorage.setItem('ach_unlocked', JSON.stringify(unlocked));
    newUnlocks.forEach(a => _showAchievementToast(a));
  }
  return newUnlocks;
}
function _showAchievementToast(a) {
  const toast = document.createElement('div');
  toast.className = 'ach-toast';
  toast.innerHTML = `<span class="ach-toast-icon">${a.icon}</span><div><div class="ach-toast-name">${icon('unlock',20)} ${san(a.name)}</div><div class="ach-toast-desc">${san(a.desc)}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('ach-toast-show'), 50);
  setTimeout(() => { toast.classList.remove('ach-toast-show'); setTimeout(() => toast.remove(), 400); }, 3500);
}
function renderAchievements() {
  const el = document.getElementById('ch-achievements-grid');
  if (!el) return;
  const unlocked = getUnlocked();
  const stats = loadAchievementStats();
  el.innerHTML = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    const prog = a.progress ? a.progress(stats) : null;
    const pct = prog ? (prog.invert
      ? Math.round((1 - prog.cur / prog.max) * 100)
      : Math.round(prog.cur / prog.max * 100)) : 0;
    const displayVal = prog ? (prog.invert
      ? `${prog.cur}${prog.unit||''} (objectif ≤ ${prog.max}${prog.unit||''})`
      : `${typeof prog.cur === 'number' && prog.cur > 999 ? prog.cur.toLocaleString() : prog.cur}${prog.unit||''} / ${typeof prog.max === 'number' && prog.max > 999 ? prog.max.toLocaleString() : prog.max}${prog.unit||''}`) : '';
    return `<div class="ach-card ${done ? 'ach-done' : 'ach-locked'}">
      <div class="ach-icon">${done ? a.icon : icon('lock',20)}</div>
      <div class="ach-name">${san(a.name)}</div>
      <div class="ach-desc">${san(a.desc)}</div>
      ${!done && prog ? `
        <div class="ach-prog-bar"><div class="ach-prog-fill" style="width:${pct}%"></div></div>
        <div class="ach-prog-val">${displayVal}</div>
      ` : done ? `<div class="ach-prog-val" style="color:#00c882">✓ Débloqué</div>` : ''}
    </div>`;
  }).join('');
  const count = unlocked.length;
  const total = ACHIEVEMENTS.length;
  const pct = Math.round(count/total*100);
  const prog = document.getElementById('ch-ach-progress');
  if (prog) prog.innerHTML = `<span>${count}/${total} débloqués</span><div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pct}%"></div></div>`;
}

// ============ HEATMAP ============

function _renderHeatmap() {
  const wrap = document.getElementById('heatmap-wrap');
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas || !wrap) return;
  const log = (typeof G !== 'undefined' && G.clickLog) ? G.clickLog : [];
  const isClick = typeof G !== 'undefined' && !['track','track_pct'].includes((typeof SCENARIOS !== 'undefined' && SCENARIOS[G.mode]?.type) || '');
  if (!isClick || log.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Background
  ctx.fillStyle = 'rgba(10,12,18,0.95)';
  ctx.fillRect(0, 0, W, H);
  // Crosshair center
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  // Draw clicks — precise positions with aim-error lines for misses
  log.forEach(p => {
    const px = p.x * W, py = p.y * H;
    if (p.hit) {
      // Green dot with glow for hits
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 10);
      grd.addColorStop(0, 'rgba(74,222,128,0.95)');
      grd.addColorStop(1, 'rgba(74,222,128,0)');
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#4ade80'; ctx.fill();
    } else {
      // Miss: show target position + error line from crosshair center → target
      const cx = W / 2, cy = H / 2;
      if (p.err > 0.02) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py);
        ctx.strokeStyle = 'rgba(255,70,85,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // ✕ marker at target position
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
      grd.addColorStop(0, 'rgba(255,70,85,0.9)');
      grd.addColorStop(1, 'rgba(255,70,85,0)');
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = '#ff4655'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px-3, py-3); ctx.lineTo(px+3, py+3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+3, py-3); ctx.lineTo(px-3, py+3); ctx.stroke();
    }
  });
  // Stats overlay
  const hits = log.filter(p => p.hit).length;
  const misses = log.filter(p => !p.hit).length;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  ctx.fillText(`${hits} hits · ${misses} misses`, 8, H - 8);

  // Stats below heatmap
  let statsEl = wrap.querySelector('.heatmap-stats');
  if (!statsEl) { statsEl = document.createElement('div'); statsEl.className = 'heatmap-stats'; wrap.appendChild(statsEl); }
  if (log.length === 0) { statsEl.innerHTML = ''; return; }
  // Compute spread (average distance from center)
  const cx = W / 2, cy = H / 2;
  const distances = log.map(p => Math.sqrt((p.x * W - cx) ** 2 + (p.y * H - cy) ** 2));
  const avgSpread = Math.round(distances.reduce((a, b) => a + b, 0) / distances.length);
  const spreadPct = Math.round(avgSpread / (Math.min(W, H) / 2) * 100);
  // Dominant zone (divide canvas into 9 zones 3x3)
  const zoneCounts = Array(9).fill(0);
  log.forEach(p => {
    const col = Math.min(2, Math.floor(p.x * 3));
    const row = Math.min(2, Math.floor(p.y * 3));
    zoneCounts[row * 3 + col]++;
  });
  const maxZone = zoneCounts.indexOf(Math.max(...zoneCounts));
  const zoneNames = ['Haut-G','Haut','Haut-D','G','Centre','D','Bas-G','Bas','Bas-D'];
  const hitRate = Math.round(hits / log.length * 100);
  statsEl.innerHTML = `
    <div class="hm-stat-row">
      <span class="hm-stat"><span class="hm-stat-val hm-hit">${hits}</span><span class="hm-stat-lbl">Hits</span></span>
      <span class="hm-stat"><span class="hm-stat-val hm-miss">${misses}</span><span class="hm-stat-lbl">Manqués</span></span>
      <span class="hm-stat"><span class="hm-stat-val">${hitRate}%</span><span class="hm-stat-lbl">Précision</span></span>
      <span class="hm-stat"><span class="hm-stat-val">${spreadPct}%</span><span class="hm-stat-lbl">Dispersion</span></span>
      <span class="hm-stat"><span class="hm-stat-val">${zoneNames[maxZone]}</span><span class="hm-stat-lbl">Zone dom.</span></span>
    </div>`;
}

// ============ WARM-UP AUTO ============

function cpGenerateWarmup() {
  const el = document.getElementById('wu-routine-wrap');
  if (!el) return;

  if (typeof SCENARIOS === 'undefined') {
    el.innerHTML = '<p class="ch-empty">Lance une partie d\'abord pour initialiser les scénarios.</p>';
    return;
  }

  // Read bench scores for medium tier
  let bench = {};
  try { bench = JSON.parse(localStorage.getItem('visc_bench_medium') || '{}'); } catch {}

  // Score each scenario: threads achieved / max threads (0–1)
  const scored = Object.entries(SCENARIOS)
    .filter(([, v]) => v.th && v.th.length > 0)
    .map(([key, v]) => {
      const best = bench[key] || 0;
      const threads = v.th.filter(t => best >= t).length;
      const maxTh = 8;
      const ratio = threads / maxTh;
      return { key, label: v.label || key, cat: v.cat, sub: v.sub, ratio, threads, maxTh };
    });

  if (scored.length === 0) {
    el.innerHTML = '<p class="ch-empty">Joue d\'abord quelques scénarios du Viscose Benchmark pour générer un warm-up personnalisé.</p>';
    return;
  }

  // Separate played vs unplayed
  const played   = scored.filter(s => bench[s.key]);
  const unplayed = scored.filter(s => !bench[s.key]);

  // Weakest played scenarios (lowest ratio)
  const weak = [...played].sort((a, b) => a.ratio - b.ratio).slice(0, 4);
  // Add 2 unplayed to discover
  const discover = unplayed.sort(() => Math.random() - 0.5).slice(0, 2);

  const routine = [
    ...weak.map((s, i) => ({ ...s, reps: i < 2 ? 3 : 2, type: 'weak', note: `Point faible — ${s.threads}/${s.maxTh} threads` })),
    ...discover.map(s => ({ ...s, reps: 1, type: 'discover', note: 'À découvrir' }))
  ];

  const totalReps = routine.reduce((a, s) => a + s.reps, 0);
  const estMin = Math.round(totalReps * 1.2);

  const CAT_SHORT = { control_tracking:'Tracking', reactive_tracking:'Réactif', flick_tech:'Flick', click_timing:'Click' };

  el.innerHTML = `
    <div class="wu-header-row">
      <div>
        <div class="wu-title">Warm-up personnalisé</div>
        <div class="wu-meta">${routine.length} exercices · ~${estMin} minutes</div>
      </div>
      <button class="wu-btn" onclick="cpGenerateWarmup()">↺ Regénérer</button>
    </div>
    <div class="wu-list">
      ${routine.map((s, i) => `
        <div class="wu-item ${s.type === 'discover' ? 'wu-discover' : 'wu-weak'}">
          <div class="wu-item-num">${i+1}</div>
          <div class="wu-item-info">
            <div class="wu-item-label">${san(s.label)}</div>
            <div class="wu-item-meta">
              <span class="wu-cat">${CAT_SHORT[s.cat]||s.cat}</span>
              ${s.type === 'weak' ? `<span class="wu-threads">${s.threads}/${s.maxTh} threads</span>` : '<span class="wu-new-badge">Nouveau</span>'}
              · <span style="color:var(--dim)">${s.note}</span>
            </div>
          </div>
          <div class="wu-reps">×${s.reps}</div>
          <button class="wu-play-btn" onclick="${typeof G !== 'undefined' ? `G.benchmarkMode=true;startGame('${s.key}')` : `alert('Lance le jeu d\\'abord')`}">▶</button>
        </div>`).join('')}
    </div>`;
}

// ============ BOOT ============
// ============ SETTINGS — MFA ============

// ============ RIOT TIER COLORS (partagé tracker + profil) ============

const _RIOT_TIER_COLORS = {
  Iron:'#9e9e9e', Bronze:'#a0693a', Silver:'#c0c0c0', Gold:'#f0c43f',
  Platinum:'#22c4c4', Diamond:'#7b5edd', Ascendant:'#2ab86f', Immortal:'#e44e6d', Radiant:'#f9e27c'
};

function _riotTierColor(rank) {
  if (!rank) return 'var(--dim)';
  const tier = rank.split(' ')[0];
  return _RIOT_TIER_COLORS[tier] || 'var(--dim)';
}

function settMfaRefresh() {
  const enabled = coachingUser?.mfa_enabled;
  const status  = document.getElementById('sett-mfa-status');
  const btn     = document.getElementById('sett-mfa-toggle-btn');
  if (status) {
    status.textContent   = enabled ? 'Activé' : 'Désactivé';
    status.style.background = enabled ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)';
    status.style.color      = enabled ? '#4ade80' : 'var(--dim)';
    status.style.border     = enabled ? '1px solid rgba(74,222,128,0.3)' : '1px solid var(--border)';
  }
  if (btn) btn.innerHTML = enabled ? icon('unlock',16)+' Désactiver le MFA' : icon('lock',16)+' Activer le MFA';
  // Masquer les deux sous-formulaires
  const ew = document.getElementById('sett-mfa-enable-wrap');
  const dw = document.getElementById('sett-mfa-disable-wrap');
  if (ew) ew.style.display = 'none';
  if (dw) dw.style.display = 'none';
}

async function settMfaToggle() {
  const enabled = coachingUser?.mfa_enabled;
  const ew = document.getElementById('sett-mfa-enable-wrap');
  const dw = document.getElementById('sett-mfa-disable-wrap');

  if (enabled) {
    // Afficher le formulaire de désactivation
    if (ew) ew.style.display = 'none';
    if (dw) dw.style.display = dw.style.display === 'none' ? '' : 'none';
    return;
  }

  // Activation — charger le QR code
  if (ew) {
    if (ew.style.display !== 'none') { ew.style.display = 'none'; return; }
    const msg = document.getElementById('sett-mfa-msg');
    if (msg) { msg.textContent = 'Chargement...'; msg.style.display = 'block'; msg.style.color = 'var(--dim)'; }
    try {
      const res  = await fetch(`${API_BASE}/profile?action=mfa-setup`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
      const data = await res.json();
      if (data.error) { if (msg) { msg.textContent = data.error; msg.style.color = '#ff4655'; } return; }
      const qr  = document.getElementById('sett-mfa-qr');
      const sec = document.getElementById('sett-mfa-secret');
      if (qr)  qr.src = data.qr_url;
      if (sec) sec.textContent = data.secret;
      if (msg) msg.style.display = 'none';
      ew.style.display = '';
      document.getElementById('sett-mfa-code')?.focus();
    } catch(e) {
      if (msg) { msg.textContent = 'Erreur réseau'; msg.style.color = '#ff4655'; msg.style.display = 'block'; }
    }
  }
}

async function settMfaConfirm() {
  const code = document.getElementById('sett-mfa-code')?.value?.replace(/\s/g, '');
  const msg  = document.getElementById('sett-mfa-msg');
  if (!code || code.length < 6) {
    if (msg) { msg.textContent = 'Code requis (6 chiffres)'; msg.style.color = '#ff4655'; msg.style.display = 'block'; }
    return;
  }
  if (msg) { msg.textContent = 'Vérification...'; msg.style.color = 'var(--dim)'; msg.style.display = 'block'; }
  try {
    const res  = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'mfa-enable', code })
    });
    const data = await res.json();
    if (data.error) {
      if (msg) { msg.textContent = data.error; msg.style.color = '#ff4655'; }
      return;
    }
    // Mise à jour token + user
    if (data.token) { coachingToken = data.token; localStorage.setItem('ch_token', data.token); }
    coachingUser = { ...coachingUser, mfa_enabled: true };
    if (msg) { msg.textContent = '✓ MFA activé avec succès !'; msg.style.color = '#4ade80'; }
    setTimeout(settMfaRefresh, 1200);
  } catch(e) {
    if (msg) { msg.textContent = 'Erreur réseau'; msg.style.color = '#ff4655'; }
  }
}

async function settMfaDisableConfirm() {
  const code = document.getElementById('sett-mfa-disable-code')?.value?.replace(/\s/g, '');
  const msg  = document.getElementById('sett-mfa-disable-msg');
  if (!code || code.length < 6) {
    if (msg) { msg.textContent = 'Code requis (6 chiffres)'; msg.style.color = '#ff4655'; msg.style.display = 'block'; }
    return;
  }
  if (msg) { msg.textContent = 'Vérification...'; msg.style.color = 'var(--dim)'; msg.style.display = 'block'; }
  try {
    const res  = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
      body: JSON.stringify({ action: 'mfa-disable', code })
    });
    const data = await res.json();
    if (data.error) {
      if (msg) { msg.textContent = data.error; msg.style.color = '#ff4655'; }
      return;
    }
    coachingUser = { ...coachingUser, mfa_enabled: false };
    if (msg) { msg.textContent = '✓ MFA désactivé.'; msg.style.color = '#4ade80'; }
    const inp = document.getElementById('sett-mfa-disable-code');
    if (inp) inp.value = '';
    setTimeout(settMfaRefresh, 1200);
  } catch(e) {
    if (msg) { msg.textContent = 'Erreur réseau'; msg.style.color = '#ff4655'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Discord OAuth callback : token ou erreur passés en query param
  const _urlParams = new URLSearchParams(window.location.search);
  const _discordToken = _urlParams.get('discord_token');
  const _discordError = _urlParams.get('discord_error');
  if (_discordToken) {
    coachingToken = _discordToken;
    localStorage.setItem('ch_token', _discordToken);
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (_discordError) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      const errEl = document.getElementById('auth-login-error');
      if (errEl) { errEl.textContent = decodeURIComponent(_discordError); errEl.style.display = 'block'; }
    }, 50);
  }

  initGlobalAuth();
  initCoaching();
  meInit();

  // ── Collapsible nav groups ──
  (function initNavGroups() {
    // Open all groups by default
    document.querySelectorAll('.ch-nav-group').forEach(g => g.classList.add('open'));

    // Toggle on header click
    document.querySelectorAll('.ch-nav-group-header').forEach(h => {
      h.addEventListener('click', () => {
        const group = h.closest('.ch-nav-group');
        group.classList.toggle('open');
      });
    });

    // Auto-open group containing active item
    const openGroupForTab = (tabId) => {
      const btn = document.querySelector(`.ch-tab-btn[data-tab="${tabId}"]`);
      if (btn) {
        const group = btn.closest('.ch-nav-group');
        if (group) group.classList.add('open');
      }
    };

    // Search filter
    const searchInput = document.getElementById('ch-nav-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        // Filter items inside groups
        document.querySelectorAll('.ch-nav-group').forEach(g => {
          let anyVisible = false;
          g.querySelectorAll('.ch-nav-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            const match = !q || text.includes(q);
            item.classList.toggle('search-hidden', !match);
            if (match) anyVisible = true;
          });
          g.classList.toggle('search-hidden', !anyVisible && !!q);
          if (q && anyVisible) g.classList.add('open');
        });
        // Filter standalone items (not in a group)
        document.querySelectorAll('.ch-sidebar-nav > .ch-nav-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          item.classList.toggle('search-hidden', q && !text.includes(q));
        });
      });
    }

    // Hook into coachingSwitchTab to auto-open the right group
    const origSwitch = window.coachingSwitchTab;
    if (origSwitch) {
      window.coachingSwitchTab = function(tabId) {
        origSwitch(tabId);
        openGroupForTab(tabId);
      };
    }
  })();

  // Les hooks endGame (_updateCoachingReturnBtn, _renderHeatmap)
  // sont appelés directement depuis game3d.js#endGame()
});
