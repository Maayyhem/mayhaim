// ============ COACHING HUB + GLOBAL AUTH ============

const API_BASE = '/api';

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
function getCompletedscenarios() { try { return JSON.parse(localStorage.getItem('ch_completed_scenarios')) || []; } catch { return []; } }
function markScenarioCompleted(id) { const c = getCompletedscenarios(); if (!c.includes(id)) { c.push(id); localStorage.setItem('ch_completed_scenarios', JSON.stringify(c)); } }
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
];

// Load scenarios: merge defaults with user-created ones from localStorage
const SCENARIOS_VERSION = 5; // bump when DEFAULT_SCENARIOS changes to clear stale cache
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
    const res = await fetch(`${API_BASE}/coach-data?type=agent`);
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
    const res = await fetch(`${API_BASE}/coach-data?type=strat`);
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
  fetch(`${API_BASE}/coach-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
    body: JSON.stringify({ data_type: 'agent', data_key: name, data_value: agentData })
  }).catch(() => {});
}

async function pushStratToDB(scenarioId, stratData) {
  if (!coachingToken) return;
  fetch(`${API_BASE}/coach-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coachingToken}` },
    body: JSON.stringify({ data_type: 'strat', data_key: String(scenarioId), data_value: stratData })
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
  const isStaff = coachingUserRole === 'admin' || coachingUserRole === 'coach';
  document.querySelectorAll('.ch-coach-only').forEach(el => {
    el.style.display = isStaff ? (el.dataset.display || '') : 'none';
  });
  // Init coaching platform (roles, student tabs, pending badge)
  if (typeof cpInit === 'function') setTimeout(cpInit, 0);
}

// ============ COACHING INIT ============

function initCoaching() {
  document.getElementById('btn-coaching').addEventListener('click', () => {
    document.getElementById('menu-screen').classList.remove('active');
    document.getElementById('coaching-screen').classList.add('active');
    // Sync DB data on open
    fetchScenariosFromDB().then(() => { if (document.getElementById('ch-scenarios')?.classList.contains('active')) coachingRenderScenarios(); });
    fetchAgentEditsFromDB();
    fetchStratsFromDB();
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
  if (tabId === 'ch-cours') coachingRenderCours();
  if (tabId === 'ch-map-editor') { if (!ME.editingScenario) meUpdateScenarioBanner(); meLoadMapImg(); meRenderSteps(); meRender(); meRenderSaved(); }
  if (tabId === 'ch-manage-scenarios') coachingRenderManageScenarios();
  if (tabId === 'ch-historique') coachingRenderHistory();
  if (tabId === 'ch-leaderboard') coachingRenderLeaderboard();
  if (tabId === 'ch-warmup') initWarmupPanel();
  if (tabId === 'cp-mon-coach')  { if (typeof cpLoadMyCoach   === 'function') cpLoadMyCoach(); }
  if (tabId === 'cp-mon-plan')   { if (typeof cpLoadPlan      === 'function') cpLoadPlan(); }
  if (tabId === 'cp-feedbacks')  { if (typeof cpLoadFeedbacks === 'function') cpLoadFeedbacks(); }
  if (tabId === 'ch-students')   { if (typeof cpLoadPlayers   === 'function') cpLoadPlayers(); }
}

// ============ DASHBOARD ============

function coachingRenderDashboard() {
  document.getElementById('ch-dash-sessions').textContent = getSessionCount();
  document.getElementById('ch-dash-scenarios').textContent = getCompletedscenarios().length;
  document.getElementById('ch-dash-accuracy').textContent = '-';
  document.getElementById('ch-dash-vods').textContent = getWatchedVods().length;
}

// ============ scenarios ============

function coachingRenderScenarios() {
  const rank = document.getElementById('ch-rank-filter')?.value || '';
  const map = document.getElementById('ch-map-filter')?.value || '';
  const type = document.getElementById('ch-type-filter')?.value || '';

  const RANK_ORDER = ['IRON','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','ASCENDANT','IMMORTAL','RADIANT'];
  let filtered = coachingScenarios;
  if (rank) filtered = filtered.filter(s => s.rank === rank);
  if (map) filtered = filtered.filter(s => s.map === map);
  if (type) filtered = filtered.filter(s => s.type === type);
  filtered = [...filtered].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  const list = document.getElementById('ch-scenarios-list');
  if (!list) return;
  list.innerHTML = '';
  if (!filtered.length) { list.innerHTML = '<p class="ch-empty">Aucun scénario trouvé.</p>'; return; }

  const completed = getCompletedscenarios();
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
      <div class="ch-card-meta">${s.map || ''} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'défense' ? 'défense' : 'Retake'}</div>
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
  document.getElementById('ch-sm-meta').textContent = `${s.map || ''} \u00b7 ${s.type === 'attack' ? 'Attaque' : s.type === 'défense' ? 'défense' : 'Retake'} \u00b7 Difficulte ${s.difficulty || 3}/5`;
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
    document.getElementById('coaching-screen').classList.remove('active');
    document.getElementById('menu-screen').classList.add('active');
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

function initWarmupPanel() {
  const panel = document.getElementById('ch-warmup');
  if (!panel) return;

  // ── Exercise buttons ─────────────────────────────────────────────────
  panel.querySelectorAll('.warmup-exercise-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const diff = btn.dataset.diff;
      document.getElementById('coaching-screen').classList.remove('active');
      document.getElementById('opt-diff').value = diff;
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

  // ── Box Breathing ─────────────────────────────────────────────────────
  const breathBtn    = document.getElementById('wu-breath-start');
  const breathCircle = document.getElementById('wu-breath-circle');
  const breathText   = document.getElementById('wu-breath-text');

  if (breathBtn && !breathBtn.dataset.bound) {
    breathBtn.dataset.bound = '1';
    let timer = null, breathRunning = false, phaseIdx = 0;

    const PHASES = [
      { text: 'Inspire',  scale: 1.5, color: '#4ade80', dur: 4000 },
      { text: 'Retiens',  scale: 1.5, color: '#60a5fa', dur: 4000 },
      { text: 'Expire',   scale: 1.0, color: '#f87171', dur: 4000 },
      { text: 'Retiens',  scale: 1.0, color: '#a78bfa', dur: 4000 },
    ];

    function runPhase(idx) {
      if (!breathRunning) return;
      const p = PHASES[idx];
      breathText.textContent             = p.text;
      breathCircle.style.transform       = `scale(${p.scale})`;
      breathCircle.style.borderColor     = p.color;
      breathText.style.color             = p.color;
      timer = setTimeout(() => runPhase((idx + 1) % PHASES.length), p.dur);
    }
    function startBreath() {
      breathRunning = true;
      breathBtn.textContent = '⏹ Stop';
      runPhase(0);
    }
    function stopBreath() {
      breathRunning = false;
      clearTimeout(timer);
      breathBtn.textContent          = '▶ Box Breathing';
      breathCircle.style.transform   = 'scale(1)';
      breathCircle.style.borderColor = 'var(--accent)';
      breathText.textContent         = 'Inspire';
      breathText.style.color         = 'var(--txt)';
    }
    breathBtn.addEventListener('click', () => breathRunning ? stopBreath() : startBreath());
  }
}

// ============ ADMIN: STUDENTS ============

async function coachingRenderStudents() {
  const list = document.getElementById('ch-students-list');
  if (!list) return;
  list.innerHTML = '<p class="ch-empty">Chargement...</p>';

  try {
    const res = await fetch(`${API_BASE}/coaching?view=all-users`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
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
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
            <select class="ch-role-select" data-user-id="${s.id}" style="flex:1;padding:6px 10px;background:var(--bg);color:var(--txt);border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:0.8rem">
              <option value="student" ${s.role==='student'?'selected':''}>Eleve</option>
              <option value="coach" ${s.role==='coach'?'selected':''}>Coach</option>
              <option value="admin" ${s.role==='admin'?'selected':''}>Admin</option>
            </select>
            <button class="ch-delete-user-btn" data-user-id="${s.id}" data-username="${s.username}"
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
        <button class="btn-del-scenario" style="padding:8px 14px;background:rgba(255,70,85,0.15);border:1px solid rgba(255,70,85,0.3);color:var(--accent);border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;font-family:var(--font);transition:all 0.12s">Supprimer</button>
      </div>
    `;
    card.querySelector('.ch-card-btn').addEventListener('click', () => coachingOpenEditModal(s));
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
    icon: '&#128293;',
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
    icon: '&#10010;',
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
    icon: '&#9678;',
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
    icon: '&#9632;',
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
    icon: '&#10148;',
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
    icon: '&#9889;',
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
    icon: '&#128065;',
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
      document.getElementById('coaching-screen').classList.remove('active');
      document.getElementById('menu-screen').classList.add('active');
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
    item.innerHTML = `<span style="font-weight:700">${s.name}</span> <span style="color:var(--dim);font-size:0.7rem">${s.map}</span> <span class="me-del" data-idx="${i}">&times;</span>`;
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

async function coachingRenderHistory() {
  const el = document.getElementById('ch-history-content');
  if (!el) return;
  if (!coachingToken) { el.innerHTML = '<p class="ch-empty">Connecte-toi pour voir ton historique.</p>'; return; }
  el.innerHTML = '<p class="ch-empty">Chargement...</p>';
  try {
    const res = await fetch(`${API_BASE}/history?limit=30`, { headers: { 'Authorization': `Bearer ${coachingToken}` } });
    if (!res.ok) throw new Error('Erreur serveur');
    const { history } = await res.json();
    if (!history || !history.length) { el.innerHTML = '<p class="ch-empty">Aucune partie jouee pour le moment.</p>'; return; }
    const modeLabel = m => m.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const fmt = d => new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">
      <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted)">
        <th style="padding:8px;text-align:left">Mode</th>
        <th style="padding:8px;text-align:right">Score</th>
        <th style="padding:8px;text-align:right">Précision</th>
        <th style="padding:8px;text-align:right">Hits</th>
        <th style="padding:8px;text-align:right">Réaction</th>
        <th style="padding:8px;text-align:right">Date</th>
      </tr></thead>
      <tbody>${history.map((h,i) => `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);${i%2===0?'background:rgba(255,255,255,0.02)':''}">
        <td style="padding:8px">${modeLabel(h.mode)}</td>
        <td style="padding:8px;text-align:right;color:var(--accent)">${Number(h.score).toLocaleString()}</td>
        <td style="padding:8px;text-align:right">${h.accuracy}%</td>
        <td style="padding:8px;text-align:right">${h.hits}</td>
        <td style="padding:8px;text-align:right">${h.avg_reaction ? h.avg_reaction+'ms' : 'N/A'}</td>
        <td style="padding:8px;text-align:right;color:var(--text-muted)">${fmt(h.played_at)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<p class="ch-empty">Erreur: ${e.message}</p>`; }
}

// ============ LEADERBOARD ============

async function coachingRenderLeaderboard() {
  const el = document.getElementById('ch-leaderboard-content');
  if (!el) return;
  el.innerHTML = '<p class="ch-empty">Chargement...</p>';
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    if (!res.ok) throw new Error('Erreur serveur');
    const { leaderboard } = await res.json();
    if (!leaderboard || !leaderboard.length) { el.innerHTML = '<p class="ch-empty">Aucun joueur dans le classement.</p>'; return; }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.88rem">
      <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted)">
        <th style="padding:10px;text-align:center">#</th>
        <th style="padding:10px;text-align:left">Joueur</th>
        <th style="padding:10px;text-align:right">Score Total</th>
        <th style="padding:10px;text-align:right">Parties</th>
        <th style="padding:10px;text-align:right">Précision</th>
        <th style="padding:10px;text-align:right">Meilleure Partie</th>
      </tr></thead>
      <tbody>${leaderboard.map((p,i) => {
        const isMe = coachingUser && p.username === coachingUser.email;
        const bg = i===0?'rgba(232,197,109,0.06)':i===1?'rgba(192,192,192,0.04)':i===2?'rgba(180,90,50,0.04)':'';
        const rank = medals[i] || `<span style="color:var(--text-muted)">${i+1}</span>`;
        const nameColor = isMe ? 'color:var(--accent)' : i===0?'color:#e8c56d':'';
        return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);${bg?'background:'+bg:''}">
          <td style="padding:10px;text-align:center;font-size:1rem">${rank}</td>
          <td style="padding:10px;font-weight:600;${nameColor}">${p.username || 'Joueur'}${isMe?' (moi)':''}</td>
          <td style="padding:10px;text-align:right;color:var(--accent);font-weight:700">${Number(p.total_score).toLocaleString()}</td>
          <td style="padding:10px;text-align:right">${p.total_games}</td>
          <td style="padding:10px;text-align:right">${p.avg_accuracy}%</td>
          <td style="padding:10px;text-align:right">${Number(p.best_game).toLocaleString()}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<p class="ch-empty">Erreur: ${e.message}</p>`; }
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', () => {
  initGlobalAuth();
  initCoaching();
  meInit();
});
