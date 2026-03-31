const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try { return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); } catch { return null; }
}

const SEED_SCENARIOS = [
  // ═══ BIND ═══
  { title: "A Hookah Execute — Bind", rank: "SILVER", map: "Bind", type: "attack", difficulty: 3,
    description: "Execute complete sur A site via hookah avec smoke CT, flash short et setup post-plant.",
    guide: "1. Controller smoke hookah ET CT box en simultane\n2. Initiator flash court depuis A showers\n3. Duelist entre hookah (pre-aim CT immediat en sortant)\n4. 2eme joueur clear short A et la box droite\n5. Plante default B main ou derriere la box selon le clear\n6. Post-plant : smoke elbow + molly spot default",
    tips: "Ne jamais entrer hookah sans smoke CT — angle mortel. Pre-aim la box a droite en sortant de hookah. La molly post-plant sous la box est quasiment impossible a defuser.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium" },
  { title: "B Short Default — Bind", rank: "BRONZE", map: "Bind", type: "attack", difficulty: 2,
    description: "Prise de B site via short avec smoke long B et garden. Strat fondamentale pour Bind.",
    guide: "1. Smoke long B depuis le coin (coupe CT et heaven)\n2. Flash B main pour le duelist\n3. Duelist entre short B (pre-aim U-Hall)\n4. 2eme joueur clear garden angle\n5. 3eme joueur tient B elbow via showers TP contre rotations\n6. Plante derriere la boite centrale (spot default B)",
    tips: "La smoke long B doit couper CT ET heaven. Toujours clear le coin derriere garden avant de planter. La boite centrale B est le meilleur spot de plant.",
    aim_mode: "w1w3ts_reload", aim_diff: "easy" },
  { title: "B Retake Express — Bind", rank: "GOLD", map: "Bind", type: "retake", difficulty: 3,
    description: "Retake rapide de B site apres plant ennemi via showers TP et garden coordonnes.",
    guide: "1. 1-2 joueurs entrent par B main (cote long B)\n2. 1 joueur teleporte showers TP (cote garden)\n3. Initiator flash/stun les defenders sur le site\n4. Smoke U-Hall pour couper les renforts\n5. Fermer la pince depuis B main + garden simultanement\n6. Ne jamais defuser seul — attendre que le site soit clear",
    tips: "Venir de 2 cotes desorganise completement les defenders. Ecouter le spike pour localiser l'ennemi. Avoir une smoke disponible avant de defuser.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium" },
  // ═══ HAVEN ═══
  { title: "C Rush Coordonne — Haven", rank: "BRONZE", map: "Haven", type: "attack", difficulty: 1,
    description: "Rush full 5 sur C site avec flash et smoke CT. Execution rapide avant les rotations adverses.",
    guide: "1. Rush a 5 sur C main des le debut du round (avant 15s)\n2. Flash depuis le coin C lobby pour aveugler CT\n3. Smoke CT box pour couper la ligne de vue du defender\n4. Entry clear corner C right puis CT corner\n5. Plante dans la boite ou spot default\n6. 1 joueur tient C garage pour couper les rotations B",
    tips: "Le rush C fonctionne sur la surprise — execute avant 15 secondes. Si les ennemis ont smoke B mid, ils sont probablement legers sur C. Ne jamais rush sans au minimum une flash.",
    aim_mode: "pokeball_frenzy", aim_diff: "easy" },
  { title: "A-C Split Strategique — Haven", rank: "PLATINUM", map: "Haven", type: "attack", difficulty: 4,
    description: "Split A et C simultanement pour forcer les defenders a se diviser et creer un 3v2 favorable.",
    guide: "1. 2 joueurs font une distraction convaincante sur A (bruit, peek sans entrer)\n2. 3 joueurs setup execute C en parallele\n3. Controller smoke mid pour couper toutes les rotations B\n4. Signal commun : les 2 font du bruit A au MEME moment que les 3 entrent C\n5. Execute C : smokes CT + C right, flash simultane\n6. Apres plant : smoke mid + B door pour hold",
    tips: "La synchronisation est TOUT. Les 2 sur A doivent etre convaincants. Si un defender reste A, c'est un 3v2 sur C automatique. Communication pre-round obligatoire.",
    aim_mode: "vox_ts2", aim_diff: "hard" },
  { title: "B Mid Control Defensif — Haven", rank: "GOLD", map: "Haven", type: "defense", difficulty: 3,
    description: "Controle du mid depuis garage et window pour dominer les rotations et tenir B site.",
    guide: "1. Sentinel setup trips/cam sur C entry des le debut\n2. 1 joueur tient B mid depuis garage (angle window)\n3. 1 joueur tient window depuis mid (crossfire naturel)\n4. Controller garde 1-2 smokes pour urgences mid\n5. Si push mid : smoke door B + crossfire garage + window ensemble\n6. Rotate B uniquement apres call confirm",
    tips: "Celui qui controle mid sur Haven controle les rotations. Le crossfire garage + window est difficile a traverser sans utils. Ne rotate JAMAIS sans call.",
    aim_mode: "pasu_reload", aim_diff: "medium" },
  // ═══ SPLIT ═══
  { title: "A Ramp Execute — Split", rank: "SILVER", map: "Split", type: "attack", difficulty: 2,
    description: "Execute A via ramp avec smokes heaven et screens pour neutraliser les positions hautes.",
    guide: "1. Controller smoke heaven ET CT box simultanement\n2. Initiator flash depuis A lobby vers le site\n3. Duelist entre par ramp (pre-aim CT immediatement)\n4. 2eme joueur clear screens depuis A main\n5. 3eme joueur tient A lobby contre les rotations mid\n6. Plante derriere la box ou default ramp",
    tips: "Heaven est l'angle le plus mortel sur A Split — toujours le smoker en premier. Ne jamais entrer A sans smoke screens. Le plant derriere la box est excellent car difficile a defuser depuis heaven smoke.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium" },
  { title: "Mid Heaven + B Execute — Split", rank: "GOLD", map: "Split", type: "attack", difficulty: 3,
    description: "Prise du mid et de heaven pour ouvrir B site depuis le haut — la strat la plus puissante sur Split.",
    guide: "1. Smoke vent mid ET mail des le debut\n2. Joueur 1 clear mid sous puis tient vent\n3. Joueur 2 monte heaven depuis mid (smoke mail couvre la montee)\n4. Le joueur heaven call toutes les positions B site\n5. Joueurs 3-4 push B main avec flash\n6. Heaven couvre l'entree et le plant",
    tips: "Controler heaven donne une vue sur TOUT B site — ce joueur devient les yeux de l'equipe. La smoke mail est non-negociable. Garder 1 joueur heaven pour le post-plant coverage.",
    aim_mode: "w1w3ts_reload", aim_diff: "medium" },
  // ═══ ASCENT ═══
  { title: "B Boat Fast Execute — Ascent", rank: "SILVER", map: "Ascent", type: "attack", difficulty: 2,
    description: "Execute rapide sur B via boat et market avec smoke CT et flash coordonnes.",
    guide: "1. Ferme les portes mid en debut de round (coupe les rotations A)\n2. Controller smoke CT box ET bench simultanement\n3. Initiator flash depuis B main\n4. Duelist entre par boat (pre-aim CT corner)\n5. 2eme joueur clear market corner depuis B main\n6. Plante derriere les boites (spot standard B Ascent)",
    tips: "Fermer les portes mid est CRUCIAL — bloque les rotations depuis A. Entre toujours boat ET market simultanement pour eviter le crossfire defensif.",
    aim_mode: "beants", aim_diff: "easy" },
  { title: "Mid Doors + A Short — Ascent", rank: "GOLD", map: "Ascent", type: "attack", difficulty: 3,
    description: "Controle du mid via les portes pour ouvrir A short et executer A en superiorite numerique.",
    guide: "1. Initiator drone/haunt pour reveal mid des le debut\n2. Smoke market window pour couper les lignes de vue mid\n3. 2 joueurs push mid (un wide, un safe pour le trade)\n4. Clear A short depuis mid avec une flash\n5. Execute A : smoke CT + catwalk flash simultanement\n6. Plante derriere generator ou spot default",
    tips: "Ne jamais push mid sans info — un OP peut eliminer 2-3 joueurs. Generator est le meilleur spot de plant sur A Ascent. Une fois mid controle, A short s'ouvre facilement.",
    aim_mode: "vox_ts2", aim_diff: "medium" },
  // ═══ ICEBOX ═══
  { title: "B Orange Rush — Icebox", rank: "GOLD", map: "Icebox", type: "attack", difficulty: 3,
    description: "Rush agressif sur B via orange avec boost container pour prendre le controle total du site.",
    guide: "1. 1 joueur booste sur le container B (position dominante)\n2. Smoke CT et yellow simultanement\n3. Flash depuis B main pour aveugler les defenders\n4. Entry clear yellow coin puis tube\n5. Le joueur sur container couvre tout le site depuis le haut\n6. Plante dans tube ou derriere la boite bleue",
    tips: "Le boost container doit se faire accroupi et silencieusement. Ce joueur voit tout le site mais est tres expose — tirer vite et se baisser. Tube est le spot de plant le plus safe contre les retakes.",
    aim_mode: "pokeball_frenzy", aim_diff: "medium" },
  { title: "A Site Hold Snowman — Icebox", rank: "PLATINUM", map: "Icebox", type: "defense", difficulty: 4,
    description: "Hold agressif A depuis snowman et rafters pour dominer l'entree et deny le take de site.",
    guide: "1. Sentinel (KJ/Cypher) setup sur A main et conveyor\n2. 1 joueur tient snowman (couvre rafters et main)\n3. 1 joueur tient rafters (vue complete sur A site)\n4. Controller garde smokes pour les urgences retake\n5. Push detect : crossfire snowman + rafters automatique\n6. Ne jamais hold seul",
    tips: "Snowman est la meilleure position de A Icebox mais exige de l'aim. Le crossfire snowman + rafters rend l'entree presque impossible. Les capteurs KJ/Cypher permettent d'anticiper les pushes.",
    aim_mode: "pasu_reload", aim_diff: "hard" },
  // ═══ LOTUS ═══
  { title: "A Default Execute — Lotus", rank: "GOLD", map: "Lotus", type: "attack", difficulty: 3,
    description: "Execute A standard sur Lotus avec cassage de porte strategique et neutralisation de tree et root.",
    guide: "1. Casse la porte A (timing : tot = surprend, tard = masque l'execute)\n2. Smoke tree ET root simultanement\n3. Flash depuis A main pour aveugler le defender\n4. Duelist pre-aim tree en entrant\n5. 2eme joueur clear root corner immediatement\n6. Plante derriere le stone ou spot default",
    tips: "Tree est l'angle LE PLUS dangereux sur A Lotus — le smoker en premier. Root est souvent tenu agressivement — approche avec une flash. Le plant derriere le stone est tres dur a defuser sans utils.",
    aim_mode: "vox_ts2", aim_diff: "medium" },
  { title: "A-B Split 5v5 — Lotus", rank: "DIAMOND", map: "Lotus", type: "attack", difficulty: 5,
    description: "Split coordonne entre A et B avec fausse pression C pour forcer les rotations et creer une superiorite numerique.",
    guide: "1. 1 joueur fait du bruit convincant sur C (peek, utils — sans entrer)\n2. 2 joueurs setup execute A\n3. 2 joueurs setup execute B\n4. Controller avec smokes longue portee place TOUT en meme temps\n5. Signal commun : les deux equipes entrent A et B simultanement\n6. Apres plant : smoke les rotations C pour hold",
    tips: "Cette strat EXIGE Brimstone ou Astra pour les smokes longue portee simultanees. La pression C doit etre convaincante. Communication et preparation pre-round sont absolument essentielles.",
    aim_mode: "pokeball_frenzy", aim_diff: "hard" },
  // ═══ SUNSET ═══
  { title: "B Default + Post-plant — Sunset", rank: "SILVER", map: "Sunset", type: "attack", difficulty: 2,
    description: "Execute B standard sur Sunset avec setup post-plant et molly pour deny le defuse.",
    guide: "1. Smoke mid (bloque les rotations) ET CT B simultanement\n2. Flash depuis B main pour le duelist\n3. Entry clear resto corner puis CT corner\n4. 2eme joueur clear back B\n5. Plante default (spot central) ou sous les escaliers (plus de cover)\n6. Post-plant : 1 molly sur le spike + smoke elbow pour hold",
    tips: "La smoke mid est critique sur Sunset — sans elle, les rotations arrivent en 5 secondes. Le plant sous les escaliers est superieur au spot default. La molly post-plant sur le spike est LA technique a maitriser.",
    aim_mode: "beants", aim_diff: "medium" },
];

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Token requis' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });

  const sql = neon(process.env.DATABASE_URL);

  // Ensure table exists with all columns
  await sql`CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    rank VARCHAR(50),
    map VARCHAR(100),
    type VARCHAR(50),
    difficulty INTEGER DEFAULT 3,
    description TEXT DEFAULT '',
    guide TEXT DEFAULT '',
    tips TEXT DEFAULT '',
    aim_mode VARCHAR(100) DEFAULT '',
    aim_diff VARCHAR(20) DEFAULT 'medium',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS aim_mode VARCHAR(100) DEFAULT ''`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS aim_diff VARCHAR(20) DEFAULT 'medium'`;

  // Check current count
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM scenarios`;

  if (count >= 10) {
    return res.status(200).json({ message: `Deja ${count} scenarios en base. Seed ignore.`, count });
  }

  // Insert all seed scenarios
  let inserted = 0;
  for (const s of SEED_SCENARIOS) {
    try {
      await sql`
        INSERT INTO scenarios (title, rank, map, type, difficulty, description, guide, tips, aim_mode, aim_diff, created_by)
        VALUES (${s.title}, ${s.rank}, ${s.map}, ${s.type}, ${s.difficulty}, ${s.description}, ${s.guide}, ${s.tips}, ${s.aim_mode}, ${s.aim_diff}, ${decoded.id})
      `;
      inserted++;
    } catch (err) {
      console.error('Seed insert error:', s.title, err.message);
    }
  }

  return res.status(200).json({ success: true, inserted, message: `${inserted} scenarios seedes en base.` });
};
