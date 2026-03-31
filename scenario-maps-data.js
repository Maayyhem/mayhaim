// ============================================================
// PRE-BUILT SCENARIO MAPS — Auto-seeded into localStorage
// Coordinates in 1024×1024 space (Valorant API minimap images)
// Only seeds entries that don't already exist (non-destructive)
// ============================================================

(function seedDefaultScenarioMaps() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('me_scenario_maps') || '{}'); } catch { saved = {}; }

  // Shorthand helpers
  const P  = (x, y, team, label) => ({ type: 'player',    x, y, team, label });
  const S  = (x, y, label)       => ({ type: 'smoke',     x, y, label });
  const F  = (x, y)              => ({ type: 'flash',     x, y });
  const Pl = (x, y)              => ({ type: 'plant',     x, y });
  const A  = (x1,y1,x2,y2,col)  => ({ type: 'arrow',     x1, y1, x2, y2, color: col||'#3fb950' });
  const SL = (x1,y1,x2,y2)      => ({ type: 'sightline', x1, y1, x2, y2 });
  const T  = (x, y, label)      => ({ type: 'text',      x, y, label });

  const defaults = {

    // ════════════════════════════════════════════
    //  BIND
    // ════════════════════════════════════════════

    1: { // A Hookah Execute — Bind
      map: 'Bind', rotation: 0,
      steps: [
        {
          label: 'Positions initiales',
          elements: [
            P(760,490,'T','1'), P(780,525,'T','2'), P(745,550,'T','3'),
            P(770,570,'T','4'), P(755,595,'T','5'),
            P(200,230,'CT','D1'), P(270,250,'CT','D2'),
            T(760,450,'Spawn AT'), T(290,185,'A Site'),
          ]
        },
        {
          label: 'Smoke + Flash',
          elements: [
            P(760,490,'T','1'), P(780,525,'T','2'),
            S(500,380,'Hookah'),
            S(200,230,'CT Box'),
            F(495,240),
            T(500,330,'Smoke hookah'), T(200,275,'Smoke CT'),
            T(495,200,'Flash Short A'),
          ]
        },
        {
          label: 'Execute — Entree Hookah',
          elements: [
            S(500,380,'Hookah'), S(200,230,'CT'),
            A(760,500, 500,390),               // duelist → hookah
            A(780,530, 520,400, '#ff4655'),    // support
            A(500,390, 395,315),               // hookah → site
            A(745,555, 495,250, '#ffdd33'),    // → Short A
            T(380,270,'Pre-aim CT!'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(265,250,'T','1'), P(320,235,'T','2'), P(290,290,'T','3'),
            S(340,305,'Elbow'), S(200,230,'CT'),
            Pl(275,250),
            T(275,200,'Plant default'),
            SL(265,250, 265,350),
          ]
        },
      ]
    },

    2: { // B Short Default — Bind
      map: 'Bind', rotation: 0,
      steps: [
        {
          label: 'Spread + Smokes',
          elements: [
            P(760,490,'T','1'), P(780,525,'T','2'), P(745,555,'T','3'),
            P(770,575,'T','4'), P(755,600,'T','5'),
            S(790,650,'Long B'),
            S(775,560,'Heaven B'),
            T(760,450,'Spawn AT'),
          ]
        },
        {
          label: 'Execute B Short',
          elements: [
            S(790,650,'Long B'),
            F(625,690),
            A(760,490, 580,685),               // → B short
            A(770,575, 740,590, '#ff4655'),    // → B main
            A(745,560, 190,665, '#3fb950'),    // via showers TP
            T(575,650,'Pre-aim U-Hall'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(695,755,'T','1'), P(665,790,'T','2'),
            P(725,770,'T','3'), P(190,700,'T','4'),
            S(790,650,'Long B'), S(710,820,'Garden'),
            Pl(710,770),
            T(710,730,'Plant default B'),
          ]
        },
      ]
    },

    3: { // B Retake Express — Bind
      map: 'Bind', rotation: 0,
      steps: [
        {
          label: 'Situation post-plant',
          elements: [
            Pl(710,770),
            P(700,765,'CT','D1'), P(730,750,'CT','D2'),
            T(710,730,'Spike planté'),
            P(325,480,'T','1'), P(350,495,'T','2'),
            P(720,610,'T','3'), P(710,625,'T','4'),
            T(360,445,'Attaquants → Retake'),
          ]
        },
        {
          label: 'Pince depuis 2 côtés',
          elements: [
            Pl(710,770),
            A(330,490, 730,680),               // B main →
            A(710,620, 715,730, '#ff4655'),    // → site
            A(190,680, 690,760, '#3fb950'),    // showers TP →
            S(655,685,'U-Hall'),
            F(680,710),
            T(640,640,'Pince!'),
          ]
        },
        {
          label: 'Défuse couvert',
          elements: [
            Pl(710,770),
            P(700,760,'T','1'),
            S(790,650,'Cover'), S(710,730,'Spike'),
            T(700,720,'Défuse couvert'),
            SL(700,760, 800,760),
            T(810,760,'Surveille'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  HAVEN
    // ════════════════════════════════════════════

    4: { // C Rush Coordonné — Haven
      map: 'Haven', rotation: 0,
      steps: [
        {
          label: 'Rush C main — 5v5',
          elements: [
            P(515,830,'T','1'), P(490,850,'T','2'), P(525,855,'T','3'),
            P(500,870,'T','4'), P(545,850,'T','5'),
            A(515,830, 210,310),
            A(490,850, 200,320, '#ff4655'),
            A(525,855, 220,335, '#3fb950'),
            T(515,790,'Rush avant 15s!'), T(210,265,'C Site'),
          ]
        },
        {
          label: 'Flash + Smoke CT',
          elements: [
            P(310,450,'T','1'),
            F(225,415),
            S(205,285,'CT Box'),
            A(310,450, 220,380),
            T(205,250,'Smoke CT'), T(225,380,'Flash ici'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(220,305,'T','1'), P(185,290,'T','2'),
            P(275,325,'T','3'), P(345,315,'T','4'),
            P(385,660,'T','5'),
            Pl(220,300),
            S(205,285,'CT Box'),
            T(220,250,'Plant default'),
            T(385,710,'Hold C garage'),
          ]
        },
      ]
    },

    5: { // A-C Split — Haven
      map: 'Haven', rotation: 0,
      steps: [
        {
          label: 'Séparation A et C',
          elements: [
            P(515,830,'T','1'), P(490,850,'T','2'), P(525,855,'T','3'),
            P(500,870,'T','4'), P(545,850,'T','5'),
            A(490,850, 210,520), A(500,870, 215,510, '#ff4655'), A(525,855, 225,505, '#3fb950'),
            A(515,830, 680,500, '#ffdd33'), A(545,850, 700,510, '#ffdd33'),
            T(210,290,'← 3 sur C'),
            T(720,285,'2 sur A →'),
          ]
        },
        {
          label: 'Smoke mid + Distraction A',
          elements: [
            S(505,435,'Mid'),
            F(810,430),
            A(705,530, 810,440),
            P(720,520,'T','4'), P(750,540,'T','5'),
            T(505,395,'Smoke mid coupe rotations'),
            T(815,480,'Distraction A'),
          ]
        },
        {
          label: 'Execute C simultané — GO!',
          elements: [
            S(205,285,'CT C'), S(185,340,'C Right'),
            F(285,440),
            A(275,530, 225,400),
            A(300,520, 240,415, '#ff4655'),
            A(315,510, 260,425, '#3fb950'),
            Pl(220,305),
            T(505,440,'GO simultané!'),
            T(220,250,'Execute C'),
          ]
        },
      ]
    },

    6: { // B Mid Control Défensif — Haven
      map: 'Haven', rotation: 0,
      steps: [
        {
          label: 'Setup défensif',
          elements: [
            P(810,300,'CT','A'), P(510,295,'CT','B'), P(210,300,'CT','C'),
            P(505,505,'CT','M1'), P(660,425,'CT','M2'),
            T(810,265,'Hold A'), T(510,255,'Hold B'), T(210,260,'Hold C'),
            T(505,555,'Garage'), T(660,385,'Window'),
          ]
        },
        {
          label: 'Crossfire Mid (Garage×Window)',
          elements: [
            P(505,505,'CT','G'), P(660,425,'CT','W'),
            SL(505,505, 660,425),
            SL(505,505, 510,295),
            SL(660,425, 510,295),
            S(510,310,'B Door'),
            T(505,455,'Crossfire G×W'),
            T(660,380,'Window'),
          ]
        },
        {
          label: 'Rotation sur call',
          elements: [
            P(505,505,'CT','G'), P(660,425,'CT','W'),
            S(505,315,'B Site'), S(660,500,'A Long'),
            A(505,505, 510,295, '#3fb950'),
            A(660,425, 700,345, '#ffdd33'),
            T(505,415,'Rotate APRÈS call confirm seulement'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  SPLIT
    // ════════════════════════════════════════════

    7: { // A Ramp Execute — Split
      map: 'Split', rotation: 0,
      steps: [
        {
          label: 'Smokes Heaven + CT',
          elements: [
            P(515,830,'T','1'), P(485,850,'T','2'), P(525,850,'T','3'),
            P(500,865,'T','4'), P(545,850,'T','5'),
            S(195,285,'Heaven'),
            S(295,245,'CT Box'),
            T(515,790,'Spawn AT'), T(235,205,'A Site'),
          ]
        },
        {
          label: 'Flash + Execute Ramp',
          elements: [
            S(195,285,'Heaven'), S(295,245,'CT'),
            F(415,420),
            A(515,830, 445,600),               // → A lobby
            A(485,850, 410,585, '#ff4655'),
            A(445,600, 405,415),               // → ramp
            A(405,415, 265,310),               // ramp → site
            A(525,850, 510,650, '#3fb950'),    // support mid
            T(375,360,'Pre-aim CT!'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(260,275,'T','1'), P(315,260,'T','2'), P(280,320,'T','3'),
            Pl(270,270),
            S(195,285,'Heaven'), S(490,430,'Lobby'),
            T(270,225,'Plant derrière la box'),
            SL(260,280, 260,380),
          ]
        },
      ]
    },

    8: { // Mid Heaven + B Execute — Split
      map: 'Split', rotation: 0,
      steps: [
        {
          label: 'Smoke Vent + Mail',
          elements: [
            P(515,830,'T','1'), P(485,850,'T','2'), P(525,850,'T','3'),
            P(500,865,'T','4'), P(545,850,'T','5'),
            S(495,350,'Vent'),
            S(495,515,'Mail'),
            T(515,790,'Spawn AT'),
          ]
        },
        {
          label: 'Control Mid + Montée Heaven',
          elements: [
            S(495,350,'Vent'), S(495,515,'Mail'),
            A(485,850, 490,620),               // → A lobby
            A(490,620, 495,430),               // → mid
            A(495,430, 195,285, '#ffdd33'),    // → heaven
            P(195,285,'T','H'),
            A(525,850, 495,435, '#3fb950'),    // second → vent
            T(195,245,'Heaven = caller!'),
          ]
        },
        {
          label: 'Execute B depuis Heaven',
          elements: [
            P(195,285,'T','H'),
            SL(195,285, 780,265),              // vue heaven → B site
            A(490,620, 780,480),               // → B main
            A(500,635, 740,495, '#ff4655'),
            F(720,465),
            Pl(780,265),
            T(195,245,'Heaven couvre B'),
            T(745,415,'Execute B!'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  ASCENT
    // ════════════════════════════════════════════

    9: { // B Boat Fast Execute — Ascent
      map: 'Ascent', rotation: 0,
      steps: [
        {
          label: 'Fermer portes + Smokes',
          elements: [
            P(515,830,'T','1'), P(490,850,'T','2'), P(525,845,'T','3'),
            P(505,865,'T','4'), P(545,845,'T','5'),
            T(510,430,'FERMER\nportes mid'),
            S(730,305,'CT Box'),
            S(795,335,'Bench'),
            T(515,790,'Spawn AT'),
          ]
        },
        {
          label: 'Execute B — Boat + Market',
          elements: [
            S(730,305,'CT'), S(795,335,'Bench'),
            F(720,430),
            A(515,830, 720,525),               // → B main
            A(490,850, 680,510, '#ff4655'),    // → market
            A(720,525, 740,365),               // → boat
            A(680,510, 650,505, '#3fb950'),    // → market corner
            T(740,330,'Boat — pre-aim CT'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(750,320,'T','1'), P(720,345,'T','2'), P(655,495,'T','3'),
            S(730,305,'CT'),
            Pl(775,320),
            T(770,270,'Plant default B'),
            SL(750,320, 825,285),
          ]
        },
      ]
    },

    10: { // Mid Doors + A Short — Ascent
      map: 'Ascent', rotation: 0,
      steps: [
        {
          label: 'Drone + Smoke Market Window',
          elements: [
            P(515,830,'T','1'), P(490,850,'T','2'), P(525,845,'T','3'),
            P(505,865,'T','4'), P(545,845,'T','5'),
            S(570,445,'Market\nWindow'),
            T(515,790,'Spawn AT'),
            T(510,380,'Drone ici →'),
          ]
        },
        {
          label: 'Push Mid — Vers A Short',
          elements: [
            S(570,445,'Market Win'),
            A(515,830, 510,600),
            A(490,850, 490,580, '#ff4655'),
            A(510,600, 510,440),               // → mid
            A(490,580, 492,420, '#ff4655'),
            A(510,440, 395,330),               // mid → A short
            T(395,290,'A Short!'),
          ]
        },
        {
          label: 'Execute A',
          elements: [
            S(200,240,'CT'), S(395,265,'Catwalk'),
            F(305,360),
            A(395,330, 265,280),               // A short → A site
            A(290,535, 265,480, '#ff4655'),    // A main → site
            Pl(215,305),
            T(215,255,'Plant generator'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  ICEBOX
    // ════════════════════════════════════════════

    11: { // B Orange Rush — Icebox
      map: 'Icebox', rotation: 0,
      steps: [
        {
          label: 'Rush B Orange',
          elements: [
            P(510,830,'T','1'), P(485,850,'T','2'), P(525,845,'T','3'),
            P(500,865,'T','4'), P(540,845,'T','5'),
            A(510,830, 630,460),
            A(485,850, 620,475, '#ff4655'),
            A(525,845, 640,455, '#3fb950'),
            T(510,790,'Spawn AT'), T(635,415,'Orange → B'),
          ]
        },
        {
          label: 'Boost Container + Smokes',
          elements: [
            S(795,305,'CT'),
            S(725,460,'Yellow'),
            A(630,460, 710,410),               // → container
            P(710,410,'T','B'),
            F(760,445),
            A(630,465, 795,405, '#ff4655'),    // → tube
            T(710,370,'BOOST\ncontainer'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(710,410,'T','B'), P(800,400,'T','2'), P(740,455,'T','3'),
            S(795,305,'CT'),
            SL(710,410, 760,385),
            Pl(800,420),
            T(800,370,'Plant tube'),
            T(710,365,'Cover depuis haut'),
          ]
        },
      ]
    },

    12: { // A Hold Snowman — Icebox
      map: 'Icebox', rotation: 0,
      steps: [
        {
          label: 'Setup défensif A',
          elements: [
            P(255,370,'CT','S'),   // snowman
            P(235,285,'CT','R'),   // rafters
            P(420,410,'CT','C'),   // conveyor/sentinel
            T(255,335,'Snowman'), T(235,250,'Rafters'),
            T(420,375,'Sentinel'),
          ]
        },
        {
          label: 'Crossfire Snowman × Rafters',
          elements: [
            P(255,370,'CT','S'), P(235,285,'CT','R'),
            SL(255,370, 235,285),
            SL(255,370, 280,445),    // cover A main
            SL(235,285, 305,380),    // rafters angle
            T(255,330,'Crossfire\nS×R'),
            T(285,490,'A main'),
          ]
        },
        {
          label: 'Réponse au push A',
          elements: [
            P(255,370,'CT','S'), P(235,285,'CT','R'),
            P(510,830,'T','P'),
            A(510,830, 280,585),
            S(380,450,'Conveyor'),
            T(255,330,'Crossfire tenu'),
            T(380,500,'Smoke conveyor'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  LOTUS
    // ════════════════════════════════════════════

    13: { // A Default Execute — Lotus
      map: 'Lotus', rotation: 0,
      steps: [
        {
          label: 'Casse porte + Smokes',
          elements: [
            P(510,830,'T','1'), P(485,850,'T','2'), P(525,845,'T','3'),
            P(500,865,'T','4'), P(540,845,'T','5'),
            T(710,500,'→ Casse porte A'),
            S(820,285,'Tree'),
            S(855,405,'Root'),
            T(510,790,'Spawn AT'),
          ]
        },
        {
          label: 'Flash + Execute A',
          elements: [
            S(820,285,'Tree'), S(855,405,'Root'),
            F(730,450),
            A(510,830, 710,500),               // → porte A
            A(485,850, 700,490, '#ff4655'),
            A(710,500, 800,340),               // → A site
            A(700,490, 790,330, '#3fb950'),
            T(800,295,'Pre-aim Tree!'),
          ]
        },
        {
          label: 'Clear + Plant',
          elements: [
            P(795,355,'T','1'), P(825,380,'T','2'),
            S(820,285,'Tree'), S(855,405,'Root'),
            Pl(800,360),
            T(790,310,'Plant derrière stone'),
            SL(795,355, 860,330),
          ]
        },
      ]
    },

    14: { // A-B Split — Lotus
      map: 'Lotus', rotation: 0,
      steps: [
        {
          label: 'Séparation 2-2-1 (Fake C)',
          elements: [
            P(510,830,'T','1'), P(485,850,'T','2'),
            P(525,845,'T','3'), P(500,865,'T','4'),
            P(540,845,'T','5'),
            A(500,865, 225,500),               // fake C (1 joueur)
            A(510,830, 710,500),               // → A (2 joueurs)
            A(485,850, 700,490, '#ff4655'),
            A(525,845, 430,420, '#3fb950'),    // → B (2 joueurs)
            A(540,845, 415,415, '#3fb950'),
            T(225,415,'Fake C →'),
          ]
        },
        {
          label: 'Smokes simultanées A + B',
          elements: [
            S(820,285,'Tree A'),  S(855,405,'Root A'),
            S(465,325,'B Door'),  S(420,270,'B Main'),
            T(510,550,'Brimstone/Astra\nsmokes simultanées'),
          ]
        },
        {
          label: 'Double execute — GO!',
          elements: [
            S(820,285,'Tree'), S(465,325,'B Door'),
            F(730,450), F(430,380),
            A(710,500, 800,340),               // A execute
            A(700,490, 790,330, '#ff4655'),
            A(430,420, 505,275),               // B execute
            A(415,415, 495,270, '#3fb950'),
            Pl(800,360), Pl(505,280),
            T(510,500,'GO SIMULTANÉ!'),
          ]
        },
      ]
    },

    // ════════════════════════════════════════════
    //  SUNSET
    // ════════════════════════════════════════════

    15: { // B Default + Post-plant — Sunset
      map: 'Sunset', rotation: 0,
      steps: [
        {
          label: 'Smokes Mid + CT B',
          elements: [
            P(510,830,'T','1'), P(485,850,'T','2'), P(525,845,'T','3'),
            P(500,865,'T','4'), P(540,845,'T','5'),
            S(505,465,'Mid'),
            S(770,280,'CT B'),
            T(510,790,'Spawn AT'),
            T(505,425,'Smoke mid'),
          ]
        },
        {
          label: 'Execute B',
          elements: [
            S(505,465,'Mid'), S(770,280,'CT'),
            F(740,440),
            A(510,830, 725,525),               // → B main
            A(485,850, 705,515, '#ff4655'),
            A(725,525, 815,420),               // → resto
            A(705,515, 800,510, '#3fb950'),    // → back B
            T(815,375,'Pre-aim CT'),
          ]
        },
        {
          label: 'Plant + Post-plant Molly',
          elements: [
            P(820,415,'T','1'), P(800,340,'T','2'),
            S(770,280,'CT'), S(740,455,'Elbow'),
            Pl(815,380),
            T(815,340,'Plant ici'),
            T(815,440,'Molly spike →'),
            SL(820,415, 825,490),
            T(825,510,'Watch'),
          ]
        },
      ]
    },

  };

  let changed = false;
  Object.entries(defaults).forEach(([id, mapData]) => {
    const key = String(id);
    if (!saved[key]) { saved[key] = mapData; changed = true; }
  });

  if (changed) {
    try { localStorage.setItem('me_scenario_maps', JSON.stringify(saved)); } catch(e) {}
  }
})();
