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
  // ═══ BIND ═══
  {
    id: 1, title: "A Hookah Execute — Bind", rank: "SILVER", map: "Bind", type: "attack", difficulty: 3,
    description: "Execute complete sur A site via hookah avec smoke CT, flash short et setup post-plant.",
    guide: "1. Controller smoke hookah ET CT box en simultané\n2. Initiator flash court depuis A showers (aveugle les angles)\n3. Duelist entre hookah (pre-aim CT immédiat en sortant)\n4. 2ème joueur clear short A et la box droite\n5. Plante default B main ou derrière la box selon le clear\n6. Post-plant : smoke elbow + molly spot default",
    tips: "Ne jamais entrer hookah sans smoke CT — c'est un angle mortel. En sortant de hookah, pre-aim immédiatement la box a droite au fond. Si CT est smoke, la box devient la priorité absolue. La molly post-plant sous la box est quasiment impossible a defuse.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 2, title: "B Short Default — Bind", rank: "BRONZE", map: "Bind", type: "attack", difficulty: 2,
    description: "Prise de B site via short avec smoke long B et garden. Strat fondamentale pour Bind.",
    guide: "1. Smoke long B depuis le coin (coupe CT et heaven)\n2. Flash B main pour le duelist\n3. Duelist entre short B (pre-aim U-Hall)\n4. 2ème joueur clear garden angle\n5. 3ème joueur tient B elbow via showers TP contre rotations\n6. Plante derrière la boite centrale (spot default B)",
    tips: "La smoke long B doit couper CT ET heaven simultanément. Toujours clear le coin derrière la porte garden avant de planter — c'est le spot préféré des defenders. La boite centrale B est le meilleur spot de plant : difficile a voir depuis toutes les entrées.",
    aim_mode: "w1w3ts_reload", aim_diff: "easy"
  },
  {
    id: 3, title: "B Retake Express — Bind", rank: "GOLD", map: "Bind", type: "retake", difficulty: 3,
    description: "Retake rapide de B site apres plant ennemi via showers TP et garden coordonnés.",
    guide: "1. 1-2 joueurs entrent par B main (cote long B)\n2. 1 joueur téléporte showers TP (arrive cote garden)\n3. Initiator flash/stun les defenders sur le site\n4. Smoke U-Hall pour couper les renforts\n5. Fermer la pince : un depuis B main, un depuis garden\n6. Ne jamais defuser seul — attendre que le site soit clear",
    tips: "Venir de 2 cotes simultanément desorganise complètement les defenders. écoute le spike pour localiser l'ennemi. Toujours avoir une smoke disponible avant de defuser. Si tu es seul sur le retake, utilise la smoke + jiggle pour forcer un tir.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },
  // ═══ HAVEN ═══
  {
    id: 4, title: "C Rush coordonné — Haven", rank: "BRONZE", map: "Haven", type: "attack", difficulty: 1,
    description: "Rush full 5 sur C site avec flash et smoke CT. Execution rapide avant les rotations adverses.",
    guide: "1. Rush a 5 sur C main des le debut du round (avant 15s)\n2. Flash depuis le coin C lobby pour aveugler CT\n3. Smoke CT box pour couper la ligne de vue du defender\n4. Entry clear corner C right puis CT corner\n5. Plante dans la boite ou spot default\n6. 1 joueur tient C garage pour couper les rotations B",
    tips: "Le rush C fonctionne sur la surprise — execute AVANT 15 secondes. Si les ennemis ont smoke B mid, ils sont probablement legers sur C. Ne jamais rush sans au minimum une flash. Le joueur garage est crucial pour détectér les rotations.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy"
  },
  {
    id: 5, title: "A-C Split stratégique — Haven", rank: "PLATINUM", map: "Haven", type: "attack", difficulty: 4,
    description: "Split A et C simultanément pour forcer les defenders a se diviser et créer un 3v2 favorable.",
    guide: "1. 2 joueurs font une distraction convaincante sur A (bruit, peek sans entrer)\n2. 3 joueurs setup execute C en parallele\n3. Controller smoke mid pour couper toutes les rotations B\n4. Signal commun : les 2 font du bruit A au même moment que les 3 entrent C\n5. Execute C : smokes CT + C right, flash simultané\n6. Apres plant : smoke mid + B door pour hold jusqu'a la fin",
    tips: "La synchronisation est TOUT dans ce split. Les 2 sur A doivent etre CONVAINCANTS — peek l'angle, fais du bruit, utilise des utils. Si un defender reste A, c'est un 3v2 sur C automatique. Communication pre-round obligatoire.",
    aim_mode: "vox_ts2", aim_diff: "hard"
  },
  {
    id: 6, title: "B Mid Control défensif — Haven", rank: "GOLD", map: "Haven", type: "défense", difficulty: 3,
    description: "Controle du mid depuis garage et window pour dominer les rotations et tenir B site.",
    guide: "1. Sentinel setup trips/cam sur C entry des le debut\n2. 1 joueur tient B mid depuis garage (angle window)\n3. 1 joueur tient window depuis mid (crossfire naturel)\n4. Controller garde 1-2 smokes pour urgences mid\n5. Si push mid : smoke door B + crossfire garage + window ensemble\n6. Rotate B uniquement apres call confirm — ne jamais rotate a l'aveugle",
    tips: "Celui qui controle mid sur Haven controle les rotations. Le crossfire garage + window est difficile a traverser sans utils. Ne rotate JAMAIS sans call — les rotations inutiles perdent des rounds. Garde toujours une smoke pour les urgences.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  // ═══ SPLIT ═══
  {
    id: 7, title: "A Ramp Execute — Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2,
    description: "Execute A via ramp avec smokes heaven et screens pour neutraliser les positions hautes.",
    guide: "1. Controller smoke heaven ET CT box simultanément\n2. Initiator flash depuis A lobby vers le site\n3. Duelist entre par ramp (pre-aim CT immédiatement)\n4. 2ème joueur clear screens depuis A main\n5. 3ème joueur tient A lobby contre les rotations mid\n6. Plante derrière la box (protege depuis heaven) ou default ramp",
    tips: "Heaven est l'angle le plus mortel sur A Split — toujours le smoker en premier. Ne jamais entrer A sans smoke screens sinon tu es exposé a 3 angles en même temps. Le plant derrière la box est excellent car difficile a defuser depuis heaven smoké.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 8, title: "Mid Heaven + B Execute — Split", rank: "GOLD", map: "Split", type: "attack", difficulty: 3,
    description: "Prise du mid et de heaven pour ouvrir B site depuis le haut — la strat la plus puissante sur Split.",
    guide: "1. Smoke vent mid ET mail des le debut (coupe les defenders)\n2. Joueur 1 clear mid sous puis tient vent\n3. Joueur 2 monte heaven depuis mid (la smoke mail couvre la montee)\n4. Le joueur heaven call toutes les positions B site\n5. Joueurs 3-4 push B main avec flash de l'initiator\n6. Heaven couvre l'entrée et le plant jusqu'a la fin du round",
    tips: "Controler heaven donne une vue sur TOUT B site — ce joueur devient les yeux de l'équipe, il doit caller chaque position. La smoke mail est non-négociable pour monter heaven. Apres le take, garder 1 joueur heaven pour le post-plant coverage.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },
  // ═══ ASCENT ═══
  {
    id: 9, title: "B Boat Fast Execute — Ascent", rank: "SILVER", map: "Ascent", type: "attack", difficulty: 2,
    description: "Execute rapide sur B via boat et market avec smoke CT et flash coordonnés.",
    guide: "1. Ferme les portes mid en debut de round (coupe les rotations A)\n2. Controller smoke CT box ET bench simultanément\n3. Initiator flash depuis B main\n4. Duelist entre par boat (pre-aim CT corner)\n5. 2ème joueur clear market corner depuis B main\n6. Plante derrière les boites (spot standard B Ascent)",
    tips: "Fermer les portes mid est CRUCIAL — ca bloque les rotations depuis A et te donne 10 secondes de plus. La smoke bench est optionnelle mais protege contre les OPs. Entre toujours boat ET market simultanément pour eviter le crossfire défensif.",
    aim_mode: "beants", aim_diff: "easy"
  },
  {
    id: 10, title: "Mid Doors + A Short — Ascent", rank: "GOLD", map: "Ascent", type: "attack", difficulty: 3,
    description: "Controle du mid via les portes pour ouvrir A short et exécuter A en supériorité numérique.",
    guide: "1. Initiator drone/haunt pour reveal mid des le debut\n2. Smoke market window pour couper les lignes de vue mid\n3. 2 joueurs push mid (un wide, un safe pour le trade)\n4. Clear A short depuis mid avec une flash\n5. Execute A : smoke CT + catwalk flash simultanément\n6. Plante derrière generator ou spot default selon le clear",
    tips: "Ne jamais push mid sans info — un OP depuis mid peut eliminer 2-3 joueurs. La combinaison drone + smoke market window est standard en competitif. Une fois mid controle, A short s'ouvre facilement (1 defender max souvent). Generator est le meilleur spot de plant sur A Ascent.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  // ═══ ICEBOX ═══
  {
    id: 11, title: "B Orange Rush — Icebox", rank: "GOLD", map: "Icebox", type: "attack", difficulty: 3,
    description: "Rush agressif sur B via orange avec boost container pour prendre le controle total du site.",
    guide: "1. 1 joueur booste sur le container B (position dominante sur le site)\n2. Smoke CT et yellow simultanément pour couper les lignes\n3. Flash depuis B main pour aveugler les defenders\n4. Entry clear yellow coin puis tube\n5. Le joueur sur container couvre tout le site depuis le haut\n6. Plante dans tube ou derrière la boite bleue",
    tips: "Le boost container doit se faire accroupi et silencieusement. Ce joueur voit tout le site mais est tres exposé — il doit tirer vite et se baisser. Si le boost est spotte, avorter le rush immédiatement et changer de plan. Tube est le spot de plant le plus safe contre les retakes.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 12, title: "A Site Hold Snowman — Icebox", rank: "PLATINUM", map: "Icebox", type: "défense", difficulty: 4,
    description: "Hold agressif A depuis snowman et rafters pour dominer l'entrée et deny le take de site.",
    guide: "1. Sentinel (KJ/Cypher) setup sur A main et conveyor des le debut\n2. 1 joueur tient snowman (couvre rafters et main)\n3. 1 joueur tient rafters (vue complete sur A site)\n4. Controller garde smokes pour les urgences retake\n5. Push detect : crossfire snowman + rafters automatique\n6. Ne jamais hold seul — les crossfires sont la clé",
    tips: "Snowman est la meilleure position de A Icebox mais exige de l'aim — tu es exposé. Le crossfire snowman + rafters rend l'entrée presque impossible sans utils. Les capteurs KJ/Cypher permettent d'anticiper les pushes. Si les ennemis ont Viper/Astra, adjust ta position.",
    aim_mode: "pasu_reload", aim_diff: "hard"
  },
  // ═══ LOTUS ═══
  {
    id: 13, title: "A Default Execute — Lotus", rank: "GOLD", map: "Lotus", type: "attack", difficulty: 3,
    description: "Execute A standard sur Lotus avec cassage de porte stratégique et neutralisation de tree et root.",
    guide: "1. Casse la porte A (timing : tot = surprend, tard = masque l'execute)\n2. Smoke tree ET root simultanément (les 2 angles mortels)\n3. Flash depuis A main pour aveugler le defender\n4. Duelist pre-aim tree en entrant (position standard du defender)\n5. 2ème joueur clear root corner immédiatement\n6. Plante derrière le stone ou spot default selon le clear",
    tips: "Casser la porte fait du bruit — utilise-le stratégiquement. Tree est l'angle LE PLUS dangereux sur A Lotus, toujours le smoker en premier. Root est souvent tenu agressivement en défense — approche avec une flash. Le plant derrière le stone est tres dur a defuser sans utils.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 14, title: "A-B Split 5v5 — Lotus", rank: "DIAMOND", map: "Lotus", type: "attack", difficulty: 5,
    description: "Split coordonné entre A et B avec fausse pression C pour forcer les rotations et créer une supériorité numérique.",
    guide: "1. 1 joueur fait du bruit convincant sur C (peek, utils — sans entrer)\n2. 2 joueurs setup execute A (smoke tree + root)\n3. 2 joueurs setup execute B (smoke B main + door)\n4. Controller avec smokes longue portee place TOUT en même temps\n5. Signal commun : les deux équipes entrent A et B simultanément\n6. Apres plant : smoke les rotations C pour hold jusqu'a la fin",
    tips: "Cette strat EXIGE Brimstone ou Astra pour les smokes longue portee simultanées. La pression C doit etre convaincante — utilise tous tes utils, fais du bruit, peek l'angle. Le signal commun 'GO' doit etre pré-établi. Communication et preparation pre-round sont absolument essentielles.",
    aim_mode: "pokeball_frenzy", aim_diff: "hard"
  },
  // ═══ SUNSET ═══
  {
    id: 15, title: "B Default + Post-plant — Sunset", rank: "SILVER", map: "Sunset", type: "attack", difficulty: 2,
    description: "Execute B standard sur Sunset avec setup post-plant et molly pour deny le defuse.",
    guide: "1. Smoke mid (bloque les rotations) ET CT B simultanément\n2. Flash depuis B main pour le duelist\n3. Entry clear resto corner puis CT corner\n4. 2ème joueur clear back B\n5. Plante default (spot central) ou sous les escaliers (plus de cover)\n6. Post-plant : 1 molly sur le spike + smoke elbow pour hold",
    tips: "La smoke mid est absolument critique sur Sunset — sans elle, les rotations arrivent en 5 secondes. Le plant sous les escaliers est supérieur au spot default car il est couvert de plusieurs angles. La molly post-plant sur le spike est LA technique a maitriser sur cette map.",
    aim_mode: "beants", aim_diff: "medium"
  },
  // ═══ BIND (suite) ═══
  {
    id: 16, title: "A Short + Showers Execute — Bind", rank: "GOLD", map: "Bind", type: "attack", difficulty: 3,
    description: "Execute coordonné sur A depuis A short et showers pour prendre le site en pince.",
    guide: "1. Controller smoke A elbow ET CT box depuis A main\n2. Initiator flash depuis A short (couvre A main et les angles)\n3. Joueur 1 entre par A short (pre-aim box default a droite)\n4. Joueur 2 sort de showers pour couper le retake CT\n5. Clear A tower depuis short si le setup le permet\n6. Plante derrière la boite A ou spot heaven selon le clear",
    tips: "La double entrée (short + showers) est la force de cet execute. Le joueur venant de showers DOIT arriver en même temps — une difference de timing detruit la synergie. La smoke elbow est optionnelle si tu fais confiance a ton aim, mais la smoke CT box est obligatoire.",
    aim_mode: "pasu_angelic", aim_diff: "medium"
  },
  {
    id: 17, title: "B TP Anchor défense — Bind", rank: "PLATINUM", map: "Bind", type: "défense", difficulty: 4,
    description: "Hold agressif de B site en utilisant le TP showers pour repositionner un sentinel et surprendre.",
    guide: "1. Sentinel (Cypher/KJ) setup B main avec trip/turret en debut de round\n2. 1 joueur hold long B depuis B elbow (angle dominant)\n3. 1 joueur se prépare pres du TP showers (pret a téléporter)\n4. Si push B : le joueur elbow retreate, le TP arrivant flanke par derrière\n5. Smoke hookah pour couper les renforts T\n6. Post-retake : sentinel re-setup le site",
    tips: "Le TP est l'element clé — utilisez-le pour changer l'angle d'attaque apres un retrait. Gardez toujours une smoke hookah. Cypher cam sur B elbow donne de l'info gratuite. Ne restez jamais plus de 3 joueurs sur B — trop prévisible.",
    aim_mode: "deadzone_drill", aim_diff: "medium"
  },
  // ═══ HAVEN (suite) ═══
  {
    id: 18, title: "A Hold Agressif Long — Haven", rank: "SILVER", map: "Haven", type: "défense", difficulty: 3,
    description: "Tient agressif de A depuis long en crossfire avec CT box pour dominer l'entrée principale.",
    guide: "1. 1 joueur prend position sur long A (derrière la boite)\n2. 1 joueur tient CT box / A corner\n3. Crossfire naturel : si T push, les 2 angles se couvrent\n4. Initiator stun l'entrée long A si push détecté\n5. Controller smoke mid A pour bloquer les rotations via mid\n6. Si perdus : reculer sur CT et wait retake",
    tips: "Le crossfire long A + CT box est l'un des plus forts du jeu. Long A est dangereux seul — ne jamais y rester sans info. Mid smoke bloque une strat classique de prise d'info. Avec Sova, un drone debut de round donne l'info sur le push A instantanement.",
    aim_mode: "crosshair_drill", aim_diff: "medium"
  },
  {
    id: 19, title: "B Rush Full — Haven", rank: "BRONZE", map: "Haven", type: "attack", difficulty: 1,
    description: "Rush pur 4-5 joueurs sur B avec flash et smoke CT. Rapide et efficace pour les rounds eco.",
    guide: "1. Utilise tous les utils de flash disponibles sur B entry\n2. 1 smoke CT immédiat en entrant\n3. Tous les joueurs entrent B en même temps\n4. 1 joueur clear garage (souvent oublié)\n5. 1er a atteindre le site commence le plant immédiatement\n6. Les autres couvrent les 3 entrées (short, garage, CT)",
    tips: "La vitesse est tout — ne pas hesiter. Flash par-dessus les murs pour aveugler les defenders. La smoke CT est la seule utility vraiment nécessaire. Si un joueur meurt avant d'entrer, continuez — la masse compense. Plante TOUJOURS le plus vite possible sur un rush.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy"
  },
  // ═══ SPLIT (suite) ═══
  {
    id: 20, title: "A Ropes + Main coordonné — Split", rank: "BRONZE", map: "Split", type: "attack", difficulty: 2,
    description: "Execute A simple en entrant depuis les ropes et le main avec smoke CT et flash.",
    guide: "1. Controller smoke CT A depuis A main\n2. Initiator flash depuis A main (couvre les 2 angles)\n3. Duelist monte les ropes (position haute, avantage de vue)\n4. 2ème joueur push A main au sol\n5. Clear A heaven depuis les ropes en priorité\n6. Plante derrière la boite centrale A",
    tips: "A Split exige que le haut et le bas entrent simultanément. La position ropes est dominante mais exposée — flash AVANT de monter. Sans smoke CT, entrer A est quasi suicidaire. La boite centrale est le spot de plant le plus defendable de A.",
    aim_mode: "w1w3ts_reload", aim_diff: "easy"
  },
  {
    id: 21, title: "B Main Execute — Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2,
    description: "Prise de B site via B main avec smoke heaven et flash screens, strategy fondamentale.",
    guide: "1. Smoke B heaven (coupe l'angle dominant du defender)\n2. Smoke window (bloque la vue depuis mid)\n3. Flash B main pour l'entry\n4. Duelist entre B main (pre-aim box et back-B)\n5. 2ème joueur clear le coin derrière B entry\n6. Plante derrière le container ou site default",
    tips: "Heaven est LA position dominante de B Split — toujours la smoker en premier. Back-B est l'angle le plus oublié mais le plus dangereux. Si heaven est free debut de round, prends-la — elle te donne vue sur tout le site.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 22, title: "A CT Hold — Split", rank: "GOLD", map: "Split", type: "défense", difficulty: 3,
    description: "défense de A site depuis CT avec sentinel setup et crossfire ropes/main pour deny l'execute.",
    guide: "1. Sentinel setup A heaven avec trip ou turret\n2. 1 joueur tient ropes depuis CT (angle eleve)\n3. 1 joueur hold A main depuis CT coin\n4. Crossfire automatique si push A\n5. Controller garde smoke pour l'urgence (smoke ropes si besoin)\n6. Jamais peeker — attendre et crossfire",
    tips: "Le hold CT sur A Split est defensivement tres fort car les angles convergent. La turret/trip sur heaven donne l'info gratuite. écoute les bruits de pas sur les ropes pour anticiper le push. Deux joueurs en crossfire main + ropes depuis CT = entrée quasi impossible.",
    aim_mode: "beants", aim_diff: "medium"
  },
  // ═══ ASCENT (suite) ═══
  {
    id: 23, title: "B Lanes Execute — Ascent", rank: "SILVER", map: "Ascent", type: "attack", difficulty: 2,
    description: "Execute B standard avec fermeture de la porte mid, smoke CT et flash pour l'entrée depuis B main.",
    guide: "1. Ferme la porte mid en debut de round (bloque les rotations rapides)\n2. Smoke CT B depuis B main\n3. Smoke market depuis B lobby\n4. Flash B main pour l'entry\n5. Duelist entre B (pre-aim CT puis market)\n6. Plante derrière la boite ou spot default B",
    tips: "Fermer la porte mid est la priorité absolue sur B Ascent — sans ca, les rotations CT arrivent en 3 secondes. Market est l'angle le plus souvent tenu agressivement. La smoke CT doit etre loin dans le site.",
    aim_mode: "speedflick", aim_diff: "medium"
  },
  {
    id: 24, title: "A Retake via Mid — Ascent", rank: "GOLD", map: "Ascent", type: "retake", difficulty: 3,
    description: "Retake de A site depuis B via mid en utilisant la porte pour arriver par l'angle inattendu.",
    guide: "1. 1-2 joueurs gardent le chemin direct CT → A\n2. 1 joueur ouvre la porte mid et traverse pour entrer A via mid\n3. Initiator flash A site depuis l'entrée CT\n4. Smoke pour couper les defenders sur generator ou heaven\n5. Pince : un depuis CT, un depuis mid\n6. Defuse en team — ne jamais solo",
    tips: "L'entrée par mid via porte est complètement inattendue. Synchronise ABSOLUMENT l'entrée des 2 cotes. Flash l'interieur du site avant d'entrer. Generator et heaven sont les 2 holds post-plant préférés des T sur A Ascent.",
    aim_mode: "ctrlsphere_clk", aim_diff: "medium"
  },
  {
    id: 25, title: "Mid + A Short Split — Ascent", rank: "PLATINUM", map: "Ascent", type: "attack", difficulty: 4,
    description: "Split A entre mid et A short pour surcharger la défense et forcer une rotation impossible.",
    guide: "1. 1 joueur prend mid control (smoke la box, clear le milieu)\n2. 2 joueurs avancent sur A short depuis T lobby\n3. Controller smoke A main depuis mid (bloque rotations CT)\n4. Timing coordonné : A short push en même temps que mid avance\n5. Joueur mid entre via passage caisse pour prendre A par derrière\n6. 2 joueurs A short entrent depuis le haut (heaven position)\n7. Plante default ou heaven selon clear",
    tips: "Le timing est absolument crucial — les deux groupes doivent entrer simultanément. Mid control pre-round est la clé : sans mid, cette strat ne fonctionne pas. La smoke A main isole les defenders de tout support.",
    aim_mode: "floatts", aim_diff: "hard"
  },
  // ═══ ICEBOX (suite) ═══
  {
    id: 26, title: "A Rafters Execute — Icebox", rank: "GOLD", map: "Icebox", type: "attack", difficulty: 3,
    description: "Execute A avec boost rafters pour prendre la position haute dominante avant l'entrée en site.",
    guide: "1. 1 joueur boost sur rafters A via le container\n2. Controller smoke snowman ET CT A simultanément\n3. Flash A main pour aveugler les defenders\n4. Joueur rafters engage depuis le haut (distrait et prend des kills)\n5. Reste de l'équipe entre A main pendant que rafters distrait\n6. Plante derrière la boite ou dans le coin belt",
    tips: "Le boost rafters est le facteur de surprise — il cree de l'info et de la distraction. Rafters est une position exposée : si spotte, retraite immédiatement. Snowman doit etre smoke — c'est le spot défensif le plus fort de A. coordonné l'entrée équipe APRES le premier engagement.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 27, title: "B Yellow + Tube Execute — Icebox", rank: "GOLD", map: "Icebox", type: "attack", difficulty: 3,
    description: "Execute B via yellow et tube simultanément avec smoke CT et flash pour surcharger la défense.",
    guide: "1. Smoke CT B depuis le coin B main\n2. Flash depuis yellow pour aveugler les defenders site\n3. Entry depuis yellow (clear coin B et back-site)\n4. Simultanément : 1 joueur push tube (entre par derrière)\n5. Pince : un depuis yellow, un depuis tube\n6. Plante dans tube (plus safe) ou site default",
    tips: "Tube est l'entrée la plus sous-estimee de B Icebox — elle coupe le retake CT. coordonnér yellow + tube est la clé du succes. Le plant dans tube est tres difficile a defuser car il y a un seul angle d'acces. Attention au sniper sur le toit depuis CT B.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 28, title: "A Retake coordonné — Icebox", rank: "PLATINUM", map: "Icebox", type: "retake", difficulty: 4,
    description: "Retake de A depuis conveyor et CT en pince avec utils pour clear snowman et belt.",
    guide: "1. 1 joueur entre A depuis CT (approche principale)\n2. 1 joueur utilise conveyor pour entrer par le cote\n3. Initiator stun/flash snowman (position la plus dangereuse)\n4. Controller smoke A main pour bloquer les renforts T\n5. Pince sur snowman : un depuis CT, un depuis conveyor\n6. Ne defuser qu'apres avoir clear snowman ET belt",
    tips: "Snowman est le point de hold post-plant n°1 sur A Icebox — le neutraliser est la priorité absolue. La pince conveyor + CT desorganise complètement les defenders. Belt est souvent le 2ème angle — toujours check apres snowman.",
    aim_mode: "burst_drill", aim_diff: "hard"
  },
  // ═══ LOTUS (suite) ═══
  {
    id: 29, title: "B Fast Execute — Lotus", rank: "SILVER", map: "Lotus", type: "attack", difficulty: 2,
    description: "Execute rapide de B avec smoke entrance et flash pour prendre le site avant les rotations.",
    guide: "1. Smoke l'entrée B main (couvre le defender standard)\n2. Flash B pour l'entry depuis le couloir\n3. Duelist entre B (pre-aim corner droit en entrant)\n4. 2ème joueur clear rubble corner\n5. Smoke C connection pour bloquer les rotations rapides\n6. Plante derrière le rocher central ou spot default B",
    tips: "B Lotus a une seule entrée principale — une bonne smoke la couvre entierement. La smoke C connection est tres utile si l'équipe a 2+ controllers. Le rocher central B est le meilleur spot de plant — il a deux cotes de couverture.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy"
  },
  {
    id: 30, title: "C Take avec Wingman — Lotus", rank: "GOLD", map: "Lotus", type: "attack", difficulty: 3,
    description: "Prise de C site en utilisant le Wingman de Gekko pour planter pendant que l'équipe couvre.",
    guide: "1. Controller smoke C corner et mound simultanément\n2. Flash C pour l'entry\n3. Duelist entre C (clear mound immédiatement)\n4. Gekko envoie Wingman vers le site pour planter (libere les mains)\n5. Pendant le plant Wingman : les 4 autres hold les 3 entrées\n6. Post-plant : Mosh pit sur le spike pour deny defuse",
    tips: "Wingman qui plante est un changement de jeu — 4 joueurs libres pour couvrir. Mound est l'angle le plus dangereux de C Lotus — toujours le clearer ou smoker. Recupere Wingman apres le round pour le suivant.",
    aim_mode: "domiswitch", aim_diff: "medium"
  },
  {
    id: 31, title: "A-C Split — Lotus", rank: "DIAMOND", map: "Lotus", type: "attack", difficulty: 5,
    description: "Split A et C avec fausse pression B au milieu pour forcer des rotations impossibles.",
    guide: "1. 1 joueur fait bruit et utils sur B main (fake)\n2. 2 joueurs setup execute A (smoke tree et root)\n3. 2 joueurs setup execute C (smoke mound et corner)\n4. Controller place toutes les smokes en simultanée (Brimstone/Astra)\n5. Signal GO : les deux groupes entrent A et C en même temps\n6. Le joueur fake B tient la connection entre les deux sites",
    tips: "nécessite un controller longue portee absolument. La pression B doit etre convaincante — utilise les pas, les utils, les peeks. La precision du timing GO est cruciale — trop ecarte et un groupe se fait nettoyer.",
    aim_mode: "waldots", aim_diff: "hard"
  },
  // ═══ SUNSET (suite) ═══
  {
    id: 32, title: "A Execute Standard — Sunset", rank: "SILVER", map: "Sunset", type: "attack", difficulty: 2,
    description: "Execute A simple via A main avec smoke CT et flash, strategy de base solide sur Sunset.",
    guide: "1. Controller smoke CT A depuis A lobby\n2. 2ème smoke pilier A (coupe la vue du defender sur le site)\n3. Flash A main pour l'entry\n4. Duelist entre A (pre-aim CT puis back)\n5. 2ème joueur clear le coin droit en entrant\n6. Plante sur le site, spot selon le clear (default ou escaliers)",
    tips: "CT est l'angle mortel sur A Sunset — toujours smoker avant d'entrer. La smoke pilier isole la partie droite du site. Escaliers A est un spot de plant tres defendable. Ne jamais entrer A seul — toujours wait au moins un partenaire.",
    aim_mode: "speedflick", aim_diff: "easy"
  },
  {
    id: 33, title: "Mid + A Execute — Sunset", rank: "GOLD", map: "Sunset", type: "attack", difficulty: 3,
    description: "Prise de mid control puis execute A en utilisant l'angle de mid pour couvrir l'entrée du site.",
    guide: "1. 1-2 joueurs prennent mid control\n2. Clear mid sous et box mid pour securiser\n3. Controller smoke CT A depuis mid (angle impossible depuis lobby)\n4. Initiator flash A depuis mid connector\n5. 2 joueurs entrent A main pendant que 1 entre depuis mid connector\n6. Plante default ou sous escaliers",
    tips: "Mid control donne un angle CT complètement inattendu. La smoke depuis mid est beaucoup plus profonde et efficace que depuis lobby. Le joueur mid connector doit entrer simultanément avec les joueurs A main.",
    aim_mode: "ctrlsphere_aim", aim_diff: "medium"
  },
  {
    id: 34, title: "B Eco Rush — Sunset", rank: "BRONZE", map: "Sunset", type: "attack", difficulty: 1,
    description: "Rush B rapide en eco avec flash seule pour prendre le site avant les rotations adverses.",
    guide: "1. Flash B main depuis le couloir\n2. Tous les joueurs entrent B ensemble (rush)\n3. 1 joueur clear CT coin immédiatement\n4. 1 joueur clear back B (angle gauche)\n5. 1er joueur arrive en site plante immédiatement\n6. Les autres couvrent B main et CT pendant le plant",
    tips: "Sur un eco, la vitesse est tout. Un seul flash suffit si bien executee. Clear CT ET back-B avant de planter. Plant rapide = le CT n'a pas le temps de defuser. Avec pistols, evite les angles longs — rush dans les coins.",
    aim_mode: "w1w3ts_reload", aim_diff: "easy"
  },
  {
    id: 35, title: "A Retake 3v2 — Sunset", rank: "GOLD", map: "Sunset", type: "retake", difficulty: 3,
    description: "Retake de A site en supériorité numérique 3v2 avec utils pour clear les positions post-plant.",
    guide: "1. Identifie les positions T via info (camera, drone, footsteps)\n2. 1 joueur entre A depuis CT (angle principal)\n3. 1 joueur entre depuis mid connector (angle surprise)\n4. Flash l'interieur du site depuis l'entrée\n5. Smoke la spike si les T sont splits\n6. Defuse en coordonné : 1 defuse, 2 couvrent",
    tips: "3v2 est largement favorable — n'hesite pas. L'entrée mid connector en simultané est la clé. Si un T tient escaliers + un tient CT : flash les deux angles en même temps. Defuser en 2 temps si nécessaire : commence, force le tir, re-defuse.",
    aim_mode: "burst_drill", aim_diff: "medium"
  },
  // ═══ BREEZE ═══
  {
    id: 36, title: "A Entry Standard — Breeze", rank: "SILVER", map: "Breeze", type: "attack", difficulty: 2,
    description: "Execute A via A main avec smoke CT et cave pour neutraliser les angles dominants du site.",
    guide: "1. Smoke CT A depuis A lobby (coupe l'angle dominant)\n2. Smoke cave/elbow pour isoler le retake\n3. Flash A main depuis le mur (couvre pilier et site)\n4. Duelist entre A (pre-aim pilier droit puis CT)\n5. 2ème joueur clear elbow si pas smoke\n6. Plante derrière le pilier ou default selon clear",
    tips: "A Breeze a les lignes de vue les plus longues du jeu — les smokes sont absolument essentielles. Pilier est la seule cover sur le site. Cave est l'angle de retake le plus rapide — toujours le couvrir. Joue vite — les repositionnements T sont rapides sur cette map.",
    aim_mode: "speedflick", aim_diff: "medium"
  },
  {
    id: 37, title: "B Tunnel Rush — Breeze", rank: "BRONZE", map: "Breeze", type: "attack", difficulty: 1,
    description: "Rush rapide B via le tunnel avec flash et smoke pour prendre le site avant que les T s'installent.",
    guide: "1. Flash tunnel depuis B lobby (jete par dessus)\n2. Controller smoke CT B (l'angle le plus dangereux)\n3. Tous entrent B tunnel ensemble\n4. 1 joueur clear le coin mur derrière (angle surprise)\n5. 1 joueur clear Arco (a droite en sortant)\n6. Plant rapide au centre du site",
    tips: "B Tunnel est serree — ne pas s'entasser. Flash doit aveugler avant d'entrer. Arco est souvent oublié mais tenu — check toujours. Plant au centre B exposée mais acceptable si CT est smoke.",
    aim_mode: "w1w3ts_reload", aim_diff: "easy"
  },
  {
    id: 38, title: "Mid Hall + A Execute — Breeze", rank: "GOLD", map: "Breeze", type: "attack", difficulty: 3,
    description: "Prise de mid puis execute A en utilisant l'angle de mid Hall pour couper les rotations.",
    guide: "1. 2 joueurs avancent sur mid (smoke si contestee)\n2. Clear mid progressivement (angles longs — etre methodique)\n3. Controller smoke CT A depuis mid hall\n4. 1 joueur maintient mid, 1 entre A via pyramide depuis mid\n5. 2 joueurs entrent A main simultanément\n6. Pince A + mid : plante dans les escaliers ou default",
    tips: "Mid Breeze est tres dangereux solo — avance toujours a 2. L'entrée A via pyramide est complètement inattendue. La smoke depuis mid hall donne un angle CT impossible a defender. Si mid est non conteste en debut de round, prenez-le TOUJOURS.",
    aim_mode: "pasu_perfected", aim_diff: "medium"
  },
  {
    id: 39, title: "A Viper Mur Hold — Breeze", rank: "PLATINUM", map: "Breeze", type: "défense", difficulty: 4,
    description: "Setup défensif de A avec Viper mur pour créer des one-ways et deny l'execute.",
    guide: "1. Viper place son mur diagonal sur A main (cree one-way)\n2. 1 joueur hold depuis derrière le mur (one-way advantage)\n3. 1 joueur tient pilier avec angle sur A site\n4. Orbe de Viper pre-place pres de CT pour le post-plant\n5. Si execute : ulti Viper sur le spike pour deny defuse\n6. Communiquer l'info via le mur (traversee = alerte)",
    tips: "Le mur Viper sur A Breeze est un des setups les plus forts du jeu — apprends le placement exact. Le one-way cree un avantage informationnel majeur. Pilier est la seule cover du site. Si les T ont Brim/Astra pour re-smoke, avoir une strat de fallback.",
    aim_mode: "ctrlsphere_aim", aim_diff: "hard"
  },
  {
    id: 40, title: "B Retake via Mid — Breeze", rank: "GOLD", map: "Breeze", type: "retake", difficulty: 3,
    description: "Retake de B site via mid Hall pour arriver de l'angle inattendu et couvrir Arco et CT B.",
    guide: "1. 1 joueur entre B depuis le chemin direct CT B\n2. 1-2 joueurs traversent mid pour entrer B par la pyramide\n3. Flash B depuis mid connection (aveugle les T sur site)\n4. Smoke Arco ou CT selon la position du spike\n5. Pince : un depuis CT B, un depuis mid\n6. Defuse en équipe : 1 defuse, 1 watch Arco, 1 watch CT",
    tips: "L'angle depuis mid est complètement surprenant. Arco est le spot de hold post-plant préféré sur B Breeze — flash ou smoke avant d'approcher. Ne pas defuser seul si Arco n'est pas clear.",
    aim_mode: "leaptrack", aim_diff: "medium"
  },
  // ═══ FRACTURE ═══
  {
    id: 41, title: "A-B Split Spawn — Fracture", rank: "GOLD", map: "Fracture", type: "attack", difficulty: 3,
    description: "Split coordonné depuis les deux spawns attaquants pour prendre A et B simultanément.",
    guide: "1. 2 joueurs avancent cote A (depuis spawn A)\n2. 3 joueurs avancent cote B via rope (depuis spawn B/milieu)\n3. Chaque groupe clear son couloir d'approche respectif\n4. Controller place smokes sur les crossfires clés de chaque site\n5. Signal GO simultanée : les deux groupes entrent ensemble\n6. Le groupe le plus avance plante selon sa position",
    tips: "Fracture est unique — les attaquants peuvent split naturellement depuis leurs spawns. La coordination timing est la clé. Ne pas attendre l'autre groupe trop longtemps. Rope side est souvent sous-utilise — c'est un avantage naturel.",
    aim_mode: "domiswitch", aim_diff: "medium"
  },
  {
    id: 42, title: "B Arcade Execute — Fracture", rank: "SILVER", map: "Fracture", type: "attack", difficulty: 2,
    description: "Execute B via arcade avec smoke dish et flash pour prendre le site rapidement.",
    guide: "1. Smoke dish (coupe le defender dish qui est tres agressif)\n2. Smoke CT B pour bloquer les rotations\n3. Flash arcade depuis le couloir\n4. Duelist entre arcade (pre-aim dish coin puis CT)\n5. 2ème joueur clear le coin escaliers\n6. Plante derrière la grande boite ou spot default",
    tips: "Dish est l'angle le plus agressif de B Fracture — toujours le smoker ou flasher. Les rotations CT arrivent vite sur B — plante rapidement. Le coin escaliers est souvent oublié mais dangerous. Si tu prends dish, tu controles tout le site.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium"
  },
  {
    id: 43, title: "A Main Entry — Fracture", rank: "BRONZE", map: "Fracture", type: "attack", difficulty: 2,
    description: "entrée simple sur A depuis A main avec smoke CT et flash pour les rounds eco ou save.",
    guide: "1. Smoke CT A (coupe l'angle dominant)\n2. Smoke bonsai si disponible (deuxieme angle dangerous)\n3. Flash A main depuis le couloir\n4. Entry clear les deux coins en entrant\n5. 1 joueur hold la connexion milieu\n6. Plant default A",
    tips: "A main est l'entrée la plus directe sur A Fracture. Bonsai est dangereux — si tu n'as qu'une smoke, priorise CT. Si defender tient agressivement bonsai : jette une flash vers lui en approchant.",
    aim_mode: "crosshair_drill", aim_diff: "easy"
  },
  {
    id: 44, title: "Rope Control + B Execute — Fracture", rank: "PLATINUM", map: "Fracture", type: "attack", difficulty: 4,
    description: "Prise de controle via la corde centrale puis execute B via le flanc pour surprendre la défense.",
    guide: "1. 1-2 joueurs prennent rope control (smoke la sortie de rope)\n2. Ils avancent et clear les angles depuis rope\n3. Controller smoke B dish ET CT B depuis rope position\n4. 2 joueurs entrent B arcade simultanément\n5. Joueur rope entre B via la sortie rope side\n6. Triple entrée B : arcade + rope + upper — impossible a hold",
    tips: "La maitrise de la corde est la clé de Fracture — sans ca, tu joues a 4v5. La triple entrée B est litteralement impossible a tenir. Smoke depuis la corde donne des angles uniques que les defenders ne voient jamais.",
    aim_mode: "floatts", aim_diff: "hard"
  },
  {
    id: 45, title: "B Dish Hold — Fracture", rank: "GOLD", map: "Fracture", type: "défense", difficulty: 3,
    description: "Hold agressif de B depuis dish pour dominer l'acces et deny l'execute avec crossfire.",
    guide: "1. 1 joueur prend dish (position agressive, vue sur arcade)\n2. 1 joueur tient le flanc rope depuis position safe\n3. Sentinel setup trip sur arcade pour l'info\n4. Si push arcade détecté : dish engage, rope flanke\n5. Si push rope détecté : retraite dish, hold depuis CT\n6. Jamais 2 joueurs en dish — trop couteux si flash",
    tips: "Dish est la meilleure position defensive de B Fracture mais tres exposée aux flashs. Toujours avoir un joueur derrière sur rope pour le trade. La trip sentinel sur arcade est l'info la plus precieuse. Si tu perds dish, retraite immédiatement.",
    aim_mode: "tamts", aim_diff: "medium"
  },
  // ═══ PEARL ═══
  {
    id: 46, title: "A Link Execute — Pearl", rank: "SILVER", map: "Pearl", type: "attack", difficulty: 2,
    description: "Execute A via link avec smoke CT et art pour neutraliser les angles principaux.",
    guide: "1. Smoke CT A depuis link (coupe l'angle le plus dangereux)\n2. Smoke art depuis lobby A\n3. Flash link pour l'entry\n4. Duelist entre link (pre-aim CT immédiatement)\n5. 2ème joueur clear le coin droit en entrant\n6. Plante derrière la grande structure centrale ou spot standard",
    tips: "CT est l'angle mortel sur A Pearl — il DOIT etre smoke. Art est l'angle secondaire mais tout aussi dangerous. Link est etroit — ne pas s'entasser. La structure centrale offre la meilleure cover pour planter.",
    aim_mode: "vox_ts2", aim_diff: "medium"
  },
  {
    id: 47, title: "B Main Rush — Pearl", rank: "BRONZE", map: "Pearl", type: "attack", difficulty: 1,
    description: "Rush rapide B via B main avec flash et smoke CT pour prendre le site en vitesse.",
    guide: "1. Flash depuis B main (jete par dessus le mur)\n2. Smoke CT B pour bloquer le defender\n3. Tous entrent B main ensemble (rush)\n4. 1 joueur clear B corner droit immédiatement\n5. 1 joueur check derrière la grande colonne\n6. Plant rapide dans le coin ou au centre",
    tips: "B Pearl a un couloir d'entrée unique — la vitesse est la seule strat valide en eco. Smoke CT obligatoire sinon l'entrée est suicidaire. Corner droit en entrant est souvent tenu agressivement. La colonne au milieu est le meilleur spot de cover pour le plant.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy"
  },
  {
    id: 48, title: "Mid + B Execute — Pearl", rank: "GOLD", map: "Pearl", type: "attack", difficulty: 3,
    description: "Prise de mid puis execute B en utilisant l'angle mid shops pour couper CT et entrer par le haut.",
    guide: "1. 2 joueurs prennent mid control (smoke connector si contestee)\n2. Controller smoke B screens depuis mid\n3. 1 joueur maintient mid pour watch les rotations A\n4. 2 joueurs avancent vers B depuis mid shops (entrée supérieure)\n5. 2 joueurs entrent B main en simultané depuis en bas\n6. Pince B depuis mid et B main simultanément",
    tips: "Mid Pearl donne acces a B par le haut — angle complètement inattendu. La smoke screens depuis mid est tres efficace car elle bloque une large zone. Le joueur maintenant mid est le guard contre les rotations A.",
    aim_mode: "ground_plaza", aim_diff: "medium"
  },
  {
    id: 49, title: "A Retake depuis CT — Pearl", rank: "GOLD", map: "Pearl", type: "retake", difficulty: 3,
    description: "Retake de A site depuis CT avec utils pour clear les positions standard de post-plant.",
    guide: "1. 2 joueurs entrent A depuis CT main (direct)\n2. 1 joueur entre par link si disponible (angle surprise)\n3. Flash A depuis l'entrée CT (aveugle les T)\n4. Smoke art si T tient depuis ce coin\n5. Clear CT corner puis structure centrale\n6. Defuse : 1 joueur defuse, 2 couvrent CT et link",
    tips: "CT est l'angle de hold post-plant le plus populaire sur A Pearl — flash it avant d'entrer. Art est le second spot préféré. Si 3v2+, envoie toujours 1 par link — la pince est decisive. Ne jamais defuser si art ou CT ne sont pas clear.",
    aim_mode: "ctrlsphere_clk", aim_diff: "medium"
  },
  {
    id: 50, title: "B CT Hold — Pearl", rank: "PLATINUM", map: "Pearl", type: "défense", difficulty: 4,
    description: "Setup défensif de B avec sentinel et crossfire depuis CT et B main pour deny l'execute.",
    guide: "1. Sentinel (KJ) setup B main avec alarmbot + turret\n2. 1 joueur tient CT B (angle dominant sur toute l'entrée)\n3. 1 joueur tient B screens depuis le milieu du site\n4. Si push détecté par sentinel : engagement depuis CT\n5. Controller garde smokes pour post-detect (smoke B main si deborde)\n6. Ne jamais push CT seul sans info — trop exposé",
    tips: "CT B Pearl est la position defensive la plus forte du site. La turret KJ en B main donne l'info ET le damage. Screens est un angle secondaire qui donne un crossfire parfait. Si tu perds CT, retraite immédiatement vers A.",
    aim_mode: "whisphere", aim_diff: "hard"
  },
  // ═══ ABYSS ═══
  {
    id: 51, title: "A Execute Standard — Abyss", rank: "SILVER", map: "Abyss", type: "attack", difficulty: 2,
    description: "Execute A classique avec smokes sur les angles clés et flash pour l'entrée en site.",
    guide: "1. Smoke A main CT (coupe le defender standard)\n2. Smoke A link pour bloquer les rotations rapides\n3. Flash depuis A lobby pour l'entry\n4. Duelist entre A (pre-aim CT puis back)\n5. 2ème joueur clear le coin derrière l'entrée\n6. Plante dans le spot default ou derrière la structure",
    tips: "Abyss a des bords sans murs — attention aux positions aux bords pour eviter les tombes accidentelles. CT est l'angle dominant. La structure centrale du site est la seule cover pour planter. Toujours checker le bord droit en entrant.",
    aim_mode: "pasu_reload", aim_diff: "medium"
  },
  {
    id: 52, title: "B Pit Execute — Abyss", rank: "GOLD", map: "Abyss", type: "attack", difficulty: 3,
    description: "Execute B avec controle du pit et smoke CT pour neutraliser les angles dangereux.",
    guide: "1. 1 joueur prend pit (position basse, vue sur CT et back B)\n2. Smoke CT B depuis B lobby\n3. Flash B main depuis le couloir\n4. Duelist entre B (pre-aim CT et back-B)\n5. Joueur pit distrait et engage pendant l'entrée\n6. Plante derrière la plateforme centrale B",
    tips: "Pit est unique sur Abyss — position basse avec vue complete. Attention aux bords autour du pit. CT B est l'angle le plus dangerous. La plateforme centrale B est le meilleur spot de plant.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium"
  },
  {
    id: 53, title: "Mid + A Rush — Abyss", rank: "PLATINUM", map: "Abyss", type: "attack", difficulty: 4,
    description: "Prise de controle du mid puis execute A pour créer un angle supérieur pendant l'entrée en site.",
    guide: "1. 2-3 joueurs fight mid pour prendre le controle\n2. Controller smoke les lignes de vue mid dangereuses\n3. Une fois mid controle : 1 joueur tient depuis mid pour couvrir\n4. 2 joueurs rush A main pendant que mid player distraie\n5. Flash A depuis mid connection\n6. Pince A : mid + main simultanément",
    tips: "Mid Abyss donne une vue plongeante sur A — avantage informationnel majeur. La fight mid est risquee mais payante si gagnee. Le joueur mid doit communiquer en permanence les positions. Decision making rapide est essentiel.",
    aim_mode: "air_voltaic", aim_diff: "hard"
  },
  {
    id: 54, title: "A défense avec Util — Abyss", rank: "GOLD", map: "Abyss", type: "défense", difficulty: 3,
    description: "Setup défensif de A avec sentinel et crossfire pour deny l'execute.",
    guide: "1. Sentinel (Cypher) setup cam sur A main + trip\n2. 1 joueur tient A CT depuis le back du site\n3. 1 joueur tient la position de mid pour les rotations\n4. Initiator garde stun/flash pour le push detect\n5. Si push détecté par cam : tous se concentrent sur A\n6. Controller smokes pour le retake si besoin",
    tips: "Cam Cypher sur A main Abyss est une des meilleures positions de cam du jeu. CT du site est la position defensive la plus forte. Attention aux bords — ne jamais reculer trop vite. Le joueur mid est le pivot pour les rotations.",
    aim_mode: "deadzone_drill", aim_diff: "medium"
  },
  {
    id: 55, title: "B Retake Express — Abyss", rank: "SILVER", map: "Abyss", type: "retake", difficulty: 3,
    description: "Retake rapide de B via l'entrée principale avec utils pour clear les positions post-plant.",
    guide: "1. Flash B depuis l'entrée (aveugle les T post-plant)\n2. 1 joueur entre B direct (CT side)\n3. 1 joueur entre par le flanc (pit si possible)\n4. Smoke la spike si T tient directement dessus\n5. Clear CT puis plateforme centrale\n6. Defuse : 1 defuse, 1 watch CT, 1 watch pit",
    tips: "CT B est le spot post-plant dominant — flash avant d'entrer. Le pit est souvent ignore par les T en post-plant — en profiter pour le flank. Defuser sous la plateforme est le plus safe.",
    aim_mode: "floatheads_t", aim_diff: "medium"
  },
  // ═══ CORRODE ═══
  {
    id: 56, title: "A Execute Standard — Corrode", rank: "SILVER", map: "Corrode", type: "attack", difficulty: 2,
    description: "Execute A avec smokes sur les angles principaux et flash pour l'entrée en site.",
    guide: "1. Smoke CT A (angle le plus dangereux)\n2. Smoke le flanc connection pour bloquer les rotations\n3. Flash A main depuis le couloir\n4. Duelist entre A (pre-aim CT et back-A)\n5. 2ème joueur clear le coin en entrant\n6. Plante dans le spot central ou derrière la structure",
    tips: "Corrode est une map relativement lineaire — les smokes sur les 2 angles principaux suffisent. Connais les spots de plant optimaux avant de jouer. La rapidite est importante car les rotations sont courtes.",
    aim_mode: "speedflick", aim_diff: "medium"
  },
  {
    id: 57, title: "B Rush coordonné — Corrode", rank: "BRONZE", map: "Corrode", type: "attack", difficulty: 1,
    description: "Rush rapide B avec flash et smoke CT pour prendre le site en vitesse.",
    guide: "1. Flash B main en debut de rush\n2. Smoke CT B pour bloquer le defender\n3. Tous entrent ensemble (rush pur)\n4. 1er joueur clear les coins de l'entrée\n5. Plant le plus rapide possible\n6. Hold les points de retake depuis le site",
    tips: "Rush eco classique sur Corrode. La smoke CT est obligatoire sinon l'entrée est dangereux. La vitesse compense le manque d'utils. Plant rapide = avantage post-plant.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy"
  },
  {
    id: 58, title: "Mid Control — Corrode", rank: "GOLD", map: "Corrode", type: "attack", difficulty: 3,
    description: "Prise de controle du mid pour dominer la map et préparer l'execute sur A ou B selon l'info.",
    guide: "1. 2 joueurs prennent mid en priorité\n2. Controller smoke les angles contestees de mid\n3. Initiator stun si defenders mid agressifs\n4. Une fois mid controle : decide A ou B selon l'info\n5. Pivoter rapidement vers le site choisi\n6. Les 3 autres joueurs sont prets a execute selon la decision",
    tips: "Mid control sur Corrode donne acces aux 2 sites — avantage stratégique majeur. La decision A ou B doit se faire vite — 20 secondes max pour pivoter. Avec bon mid control, les defenders ne peuvent pas pre-setup contre un site specifique.",
    aim_mode: "pasu_angelic", aim_diff: "medium"
  },
  {
    id: 59, title: "A Retake coordonné — Corrode", rank: "GOLD", map: "Corrode", type: "retake", difficulty: 3,
    description: "Retake de A site avec utils et pince pour clear les positions post-plant adverses.",
    guide: "1. Identifie les positions T via footsteps ou utils\n2. 2 joueurs entrent A depuis l'entrée principale\n3. 1 joueur entre via le flanc/connection si disponible\n4. Flash l'interieur du site avant d'entrer\n5. Smoke les spots de post-plant connus\n6. Defuse en équipe : 1 defuse, les autres couvrent",
    tips: "Le flanc est souvent la clé du retake — les T ne s'y attendent pas. Flash AVANT d'entrer — ne jamais peek les T post-plant a l'aveugle. Si tu connais les spots de post-plant, smoke les directement.",
    aim_mode: "burst_drill", aim_diff: "medium"
  },
];

// Load scenarios: merge defaults with user-created ones from localStorage
const SCENARIOS_VERSION = 3; // bump when DEFAULT_SCENARIOS changes to clear stale cache
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
    const merged = JSON.parse(JSON.stringify(DEFAULT_SCENARIOS));
    scenarios.forEach(s => {
      const idx = merged.findIndex(m => m.id === s.id);
      if (idx !== -1) merged[idx] = { ...merged[idx], ...s };
      else merged.push(s);
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

  let filtered = coachingScenarios;
  if (rank) filtered = filtered.filter(s => s.rank === rank);
  if (map) filtered = filtered.filter(s => s.map === map);
  if (type) filtered = filtered.filter(s => s.type === type);

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
